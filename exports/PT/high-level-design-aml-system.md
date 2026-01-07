---
title: "HIGH-LEVEL DESIGN: AML SYSTEM"
confluenceId: "149323923"
confluenceSpaceKey: "PT"
confluenceUrl: "https://f8a.atlassian.net/wiki/spaces/PT/pages/149323923/HIGH-LEVEL+DESIGN+AML+SYSTEM"
confluenceVersion: 25
confluenceCreatedBy: "terry@f8a.io"
confluenceCreatedAt: "2025-12-22T06:46:08.545Z"
confluenceUpdatedAt: "2025-12-22T06:46:08.545Z"
confluenceParentId: "134152426"
macros:
  mermaid: 0
  code: 12
  diagrams: 0
  panels: 0
exportedAt: "2026-01-07T20:34:49.800Z"
exportedBy: "conflu-exporter"
---
# HIGH-LEVEL DESIGN: AML SYSTEM

## 1\. TỔNG QUAN (OVERVIEW)

### 1.1. Giới thiệu

Hệ thống **AML (Anti-Money Laundering)** là module trung tâm chịu trách nhiệm đảm bảo tuân thủ các quy định của Ngân hàng Nhà nước (NHNN) về phòng chống rửa tiền. Hệ thống thực hiện việc sàng lọc khách hàng (Merchant) ngay từ khâu đăng ký và giám sát giao dịch thời gian thực để phát hiện, ngăn chặn các hành vi đáng ngờ.

### 1.2. Mục tiêu Nghiệp vụ - Functional Requirements

-   **F-01: Sàng lọc Merchant (Onboarding Screening)**
    
    -   Tự động kiểm tra thông tin Merchant (Tên, MST, CCCD/Hộ chiếu) so với danh sách cấm (Negative List: Blacklist, Sanction, PEP) ngay khi đăng ký.
        
    -   Hỗ trợ cơ chế khớp chính xác (Exact Match) cho MST/CCCD và khớp mờ (Fuzzy Match) cho Tên.
        
    -   Trả về kết quả ngay lập tức: `GREEN` (Sạch), `YELLOW` (Trùng - Cần review), hoặc `RED` (Từ chối tự động).[Result Type](#531-result-mapping)
        
-   **F-02: Giám sát Giao dịch (Transaction Monitoring - TM)**
    
    -   Giám sát thời gian thực (Real-time/Near real-time) tất cả dòng tiền vào/ra của Merchant.
        
    -   Áp dụng **Dynamic Rule Engine** để phát hiện các mẫu hình nghi vấn:
        
        -   Giao dịch lớn (LVT): Ví dụ > 400 triệu VND.
            
        -   Cấu trúc (Structuring): Chia nhỏ giao dịch để né ngưỡng báo cáo.
            
        -   Tần suất cao (Velocity): Số lượng giao dịch tăng đột biến so với trung bình lịch sử.
            
    -   Hỗ trợ cấu hình Rule linh hoạt qua giao diện “Natural Language” mà không cần deploy lại code.
        
-   **F-03: Quản lý Case (Case Management)**
    
    -   Tự động tạo hồ sơ điều tra (Case) khi có cảnh báo (Alert) từ quá trình Sàng lọc hoặc Giám sát giao dịch.
        
    -   Cung cấp quy trình làm việc (Workflow) cho nhân viên Tuân thủ: Phân công, Điều tra, Ghi chú, Yêu cầu bổ sung thông tin (EDD), và Ra quyết định (Đóng/Báo cáo).
        
-   **F-04: Quản lý Cấu hình & Danh sách (Configuration Management)**
    
    -   Cho phép Admin tải lên và quản lý các danh sách cấm (Negative List).
        
    -   Cho phép Admin tạo/sửa/xóa các Rule giám sát, kiểm thử Rule (Rule Testing) trước khi kích hoạt.
        
-   **F-05: Báo cáo & Tuân thủ (Regulatory Reporting)**
    
    -   Tự động tổng hợp dữ liệu để xuất các báo cáo bắt buộc theo định dạng của NHNN: Báo cáo giao dịch đáng ngờ (STR) và Báo cáo giao dịch giá trị lớn (GDL/LVT).
        

---

## 2\. KIẾN TRÚC & LUỒNG XỬ LÝ (ARCHITECTURE & GENERAL FLOW)

Hệ thống sử dụng kiến trúc **Event-Driven với Reactive Programming** (Spring WebFlux) kết hợp **Synchronous gRPC** cho các tác vụ cần phản hồi tức thì.

### 2.1. Sơ đồ Kiến trúc Tổng quan

### 2.2. Giải thích Luồng xử lý (Detailed Flow)

#### A. Luồng Sàng lọc Onboarding (Synchronous gRPC)

-   **Trigger:** Merchant thực hiện đăng ký/cập nhật hồ sơ trên **Merchant Portal Service**.
    
-   **Process:**
    
    1.  Merchant Portal Service gọi gRPC `ScreenOnboarding` sang `AML Service`
        
    2.  AML Service thực hiện 2 giai đoạn tuần tự:
        
        -   **Phase 1 - Negative List Screening:** Kiểm tra thông tin (full\_name, company\_name, tax\_code, nid) với bảng `negative_list` bằng exact match
            
        -   **Phase 2 - Risk Scoring:** Nếu pass Phase 1, thực thi các Rule scorecard để tính điểm rủi ro
            
    3.  Tổng hợp kết quả và lưu vào `case_monitors` + `case_details`
        
-   **Output:** Trả về kết quả ngay lập tức:
    
    -   `result_flag`: `GREEN` (An toàn), `YELLOW` (Cần review), `RED` (Từ chối)
        
    -   `risk_score`: Tổng điểm từ scorecard
        
    -   `risk_level`: `LOW`, `MEDIUM`, `HIGH`
        

#### B. Luồng Giám sát Giao dịch (Asynchronous Event-Driven)

-   **Trigger:** Transaction Core gọi gRPC `MonitoringTransaction` sau khi giao dịch thành công.
    
-   **Process:**
    
    1.  `AML Service` nhận request và publish event `MonitoringTransactionEvent` lên Kafka
        
    2.  Trả response ngay lập tức cho Transaction Core (không block)
        
    3.  Kafka Consumer consume event và xử lý async:
        
        -   Lưu transaction vào bảng `transaction_events`
            
        -   Load active transaction monitoring rules từ cache/DB
            
        -   Execute Rule Engine với transaction data
            
        -   Nếu có Rule matched → Tạo `case_monitors` (type=TRANSACTION) và `case_details`
            
-   **Lợi ích:** Không làm chậm luồng thanh toán, có thể chạy các rule phức tạp mà không ảnh hưởng user experience.
    

#### C. Luồng Quản lý CMS (REST APIs)

-   **Trigger:** Admin thao tác trên CMS Portal.
    
-   **Process:**
    
    -   Admin quản lý Negative List (import/export Excel)
        
    -   Admin quản lý Rules (create, update, test)
        
    -   Admin quản lý Scorecard configuration (groups, categories, criteria)
        
    -   Admin xem danh sách Case Monitors và chi tiết để điều tra
        
-   **Features:**
    
    -   Pagination cho performance
        
    -   Export Excel để báo cáo
        
    -   Real-time rule testing trước khi deploy
        

---

## 3\. SEQUENCE DIAGRAMS (DETAIL USE CASES)

### Use Case 1: Sàng lọc Merchant (Onboarding Screening)

**Mô tả:** Quy trình này diễn ra khi Merchant thực hiện đăng ký hoặc cập nhật thông tin hồ sơ (KYC) trên cổng Merchant Portal. Hệ thống thực hiện kiểm tra đồng bộ (Synchronous) để xác định xem Merchant có nằm trong các danh sách cấm (Blacklist, Sanction, PEP) hay không.

**Luồng xử lý kỹ thuật:**

Quy trình Sàng lọc Merchant mới sẽ bao gồm 2 giai đoạn nối tiếp nhau (Sequential Pipeline):

1.  **Giai đoạn 1: Knockout (Negative List Check)**
    
    -   Kiểm tra thông tin Merchant với danh sách cấm (Sanction, Blacklist, Law Enforcement).
        
    -   Nếu **HIT**: Gán ngay 25 điểm (Knockout Score), trả về kết quả `REJECT` tức thì. Dừng quy trình.
        
    -   Nếu **CLEAN**: Chuyển sang Giai đoạn 2.
        
2.  **Giai đoạn 2: Risk Scoring (Matrix Evaluation)**
    
    -   Hệ thống đánh giá các yếu tố rủi ro dựa trên dữ liệu Merchant cung cấp (Ngành nghề, Loại hình pháp lý, Địa lý, Vận hành…).
        
    -   Tính tổng điểm rủi ro (Total Score).
        
    -   So sánh với ngưỡng (Cut-off Score = 25):
        
        -   **Score >= 25**: Phân loại **High Risk**. Yêu cầu thẩm định nâng cao (`EDD_REQUIRED`).
            
        -   **Score < 25**: Phân loại **Low Risk**. Cho phép thông qua (`PASS`/`SDD`).
            

### 1.2. Sequence Diagram

Biểu đồ dưới đây mô tả chi tiết luồng tương tác giữa Merchant Portal và AML Service trong quy trình mới.

### Use Case 2: Giám sát Giao dịch Bất đồng bộ (Async Transaction Monitoring)

**Mô tả:** Quy trình này thực hiện phân tích giao dịch sau khi giao dịch đã được ghi nhận (Post-transaction Analysis). Transaction Core System gửi gRPC request đến AML Service, sau đó AML Service publish event lên Kafka để xử lý bất đồng bộ. Mục tiêu là phát hiện các mẫu hình rủi ro phức tạp mà không làm chậm luồng thanh toán chính.

**Luồng xử lý kỹ thuật:**

1.  **Transaction Request:** `Transaction Core` gọi gRPC `MonitoringTransaction` sang `AML Service` với thông tin giao dịch đầy đủ.
    
2.  **Publish Event:** `AML Service` publish event `MonitoringTransactionEvent` lên Kafka Topic và trả về response ngay lập tức cho Transaction Core.
    
3.  **Async Processing:** Kafka Consumer trong `AML Service` consume event và thực hiện:
    
    -   Lưu transaction event vào database (`transaction_events`)
        
    -   Load các Rule monitoring từ cache/database
        
    -   Thực thi Rule Engine với input data
        
    -   Tạo Case Monitor nếu phát hiện vi phạm
        
4.  **Case Creation:** Nếu có Rule matched, hệ thống tạo `case_monitors` và `case_details` với thông tin vi phạm chi tiết.
    

### Use Case 3: Quản lý Scorecard và Rule Configuration

**Mô tả:** Hệ thống cung cấp khả năng quản lý cấu hình Scorecard (đánh giá rủi ro onboarding) và Rule Engine (monitoring) thông qua REST APIs. Admin có thể tạo, cập nhật, và test rules trước khi deploy vào production.

**Luồng xử lý kỹ thuật:**

1.  **Scorecard Configuration:** Admin quản lý cấu trúc phân cấp: Groups → Categories → Criterias. Mỗi criteria liên kết với một Rule để evaluate điều kiện.
    
2.  **Rule Management:**
    
    -   Admin tạo Rule với AST (Abstract Syntax Tree) definition
        
    -   System compile và validate Rule syntax
        
    -   Rule được link với Scorecard Criteria (nếu là ONBOARDING\_SCORING)
        
    -   System cache active rules cho performance
        
3.  **Risk Threshold:** Cấu hình cutoff value để xác định risk level (LOW/MEDIUM/HIGH) dựa trên tổng điểm scorecard.
    

---

## 4\. CÔNG NGHỆ SỬ DỤNG (TECHNOLOGY STACK)

| Hạng mục | Công nghệ |
| --- | --- |
| Language | Java 21 |
| Framework | Spring Boot 3 (WebFlux - Reactive) |
| Messaging | Apache Kafka |
| Communication | gRPC (Protobuf) + REST API |
| Cache/State | Redis (Lettuce Client) |
| Database | PostgreSQL (R2DBC - Reactive) |
| Migration | Liquibase |
| Build Tool | Gradle |
| API Docs | SpringDoc OpenAPI 3 (Swagger UI) |

---

## 5\. THIẾT KẾ CHI TIẾT (DETAILED DESIGN)

### 5.1. Thiết kế Database Schema (PostgreSQL)

#### 1\. Bảng `rules` (Cấu hình Rule)

Lưu trữ định nghĩa logic của Rule dưới dạng AST Node và các Action configuration.

| Field Name | Data Type | Constraints | Description |
| --- | --- | --- | --- |
| id | VARCHAR(36) | PK, NOT NULL | Định danh duy nhất của Rule (UUID). |
| rule_name | VARCHAR(200) | UNIQUE, NOT NULL | Tên hiển thị của Rule. |
| description | TEXT | NULLable | Mô tả ý nghĩa nghiệp vụ. |
| rule_definition | JSONB | NOT NULL | Cấu trúc AST Node (Abstract Syntax Tree). |
| actions | JSONB | NULLable | Danh sách actions thực thi khi rule được evaluate. |
| success_actions | JSONB | NULLable | Actions thực thi khi rule matched (TRUE). |
| failure_actions | JSONB | NULLable | Actions thực thi khi rule không matched (FALSE). |
| rule_order | INTEGER | Default 50, NOT NULL | Thứ tự ưu tiên thực thi (Số càng nhỏ chạy trước). |
| enabled | BOOLEAN | Default TRUE, NOT NULL | Trạng thái kích hoạt. |
| category | VARCHAR(50) | NULLable | Nhóm/danh mục của Rule. |
| required_facts | TEXT[] | Default {}, NOT NULL | Danh sách facts cần thiết cho rule. |
| type | VARCHAR(100) | NOT NULL | Loại rule (ONBOARDING_SCORING, TRANSACTION_MONITORING). |
| scorecard_criteria_id | VARCHAR(36) | FK → scorecard_criterias(id) | ID criteria scorecard (nếu là rule scoring). |
| version | INTEGER | Default 1, NOT NULL | Phiên bản Rule. |
| deleted | BOOLEAN | Default FALSE, NOT NULL | Soft delete flag. |

CREATE TABLE rules (
    id VARCHAR(36) PRIMARY KEY,
    rule\_name VARCHAR(200) UNIQUE NOT NULL,
    description TEXT,
    rule\_definition JSONB NOT NULL,
    actions JSONB,
    success\_actions JSONB,
    failure\_actions JSONB,
    rule\_order INTEGER DEFAULT 50 NOT NULL,
    enabled BOOLEAN DEFAULT TRUE NOT NULL,
    category VARCHAR(50),
    required\_facts TEXT\[\] DEFAULT '{}' NOT NULL,
    type VARCHAR(100) NOT NULL,
    scorecard\_criteria\_id VARCHAR(36),
    version INTEGER DEFAULT 1 NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    created\_by VARCHAR(100),
    created\_at TIMESTAMP,
    updated\_by VARCHAR(100),
    updated\_at TIMESTAMP,
    CONSTRAINT fk\_rule\_scorecard\_criteria FOREIGN KEY (scorecard\_criteria\_id)
        REFERENCES scorecard\_criterias(id)
);

#### 2\. Bảng `case_monitors` (Quản lý Hồ sơ Giám sát)

Lưu trữ thông tin các case được tạo ra từ quá trình screening và monitoring.

| Field Name | Data Type | Constraints | Description |
| --- | --- | --- | --- |
| id | VARCHAR(36) | PK, NOT NULL | Định danh Case (UUID). |
| customer_id | VARCHAR(50) | NOT NULL, Index | ID của Customer/Merchant được giám sát. |
| customer_code | VARCHAR(50) | NULLable | Mã Customer/Merchant. |
| customer_name | VARCHAR(255) | NULLable | Tên Customer/Merchant. |
| monitor_type | VARCHAR(50) | NOT NULL | Loại giám sát: ONBOARDING, TRANSACTION. |
| status | VARCHAR(30) | NOT NULL | Trạng thái: OPEN, INVESTIGATING, CLOSED. |
| result | VARCHAR(20) | NOT NULL | Kết quả: NONE, GREEN, YELLOW, RED. |
| risk_score | INTEGER | NULLable | Tổng điểm rủi ro (từ scorecard). |
| risk_level | VARCHAR(20) | NULLable | Mức độ rủi ro: LOW, MEDIUM, HIGH. |
| metadata | JSONB | NULLable | Thông tin metadata bổ sung. |
| deleted | BOOLEAN | Default FALSE | Soft delete flag. |

CREATE TABLE case\_monitors (
    id VARCHAR(36) PRIMARY KEY,
    customer\_id VARCHAR(50) NOT NULL,
    customer\_code VARCHAR(50),
    customer\_name VARCHAR(255),
    monitor\_type VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL,
    result VARCHAR(20) NOT NULL,
    risk\_score INTEGER,
    risk\_level VARCHAR(20),
    metadata JSONB,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    created\_by VARCHAR(100),
    created\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP,
    updated\_by VARCHAR(100),
    updated\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP
);
CREATE INDEX idx\_case\_monitors\_customer\_id ON case\_monitors(customer\_id);
CREATE INDEX idx\_case\_monitors\_status ON case\_monitors(status);
CREATE INDEX idx\_case\_monitors\_monitor\_type ON case\_monitors(monitor\_type);

#### 3\. Bảng `negative_list` (Danh sách Cấm)

Lưu trữ dữ liệu Blacklist, PEP, Sanction, SIP phục vụ Sàng lọc.

| Field Name | Data Type | Constraints | Description |
| --- | --- | --- | --- |
| id | VARCHAR(36) | PK, NOT NULL | Định danh duy nhất (UUID). |
| full_name | VARCHAR(255) | NULLable | Tên đầy đủ của cá nhân. |
| company_name | VARCHAR(255) | NULLable | Tên công ty/tổ chức. |
| tax_code | VARCHAR(50) | NULLable, UNIQUE | Mã số thuế. |
| nid | VARCHAR(50) | NULLable, UNIQUE | Số CMND/CCCD/Hộ chiếu. |
| negative_type | VARCHAR(50) | NOT NULL | Loại: BLACKLIST, SANCTION, PEP, SIP, NEGATIVE_NEWS. |
| source | VARCHAR(255) | NULLable | Nguồn dữ liệu. |
| deleted | BOOLEAN | Default FALSE | Soft delete flag. |

CREATE TABLE negative\_list (
    id VARCHAR(36) PRIMARY KEY,
    full\_name VARCHAR(255),
    company\_name VARCHAR(255),
    tax\_code VARCHAR(50) UNIQUE,
    nid VARCHAR(50) UNIQUE,
    negative\_type VARCHAR(50) NOT NULL,
    source VARCHAR(255),
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    created\_by VARCHAR(100),
    created\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP NOT NULL,
    updated\_by VARCHAR(100),
    updated\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP NOT NULL
);
CREATE INDEX idx\_negative\_list\_tax\_code ON negative\_list(tax\_code);
CREATE INDEX idx\_negative\_list\_nid ON negative\_list(nid);
CREATE INDEX idx\_negative\_list\_deleted ON negative\_list(deleted);

#### 4\. Bảng `white_list` (Danh sách Trắng)

Lưu trữ dữ liệu các entity được tin cậy/được phê duyệt trước.

| Field Name | Data Type | Constraints | Description |
| --- | --- | --- | --- |
| id | VARCHAR(36) | PK, NOT NULL | Định danh duy nhất (UUID). |
| full_name | VARCHAR(255) | NULLable | Tên đầy đủ của cá nhân. |
| company_name | VARCHAR(255) | NULLable | Tên công ty/tổ chức. |
| tax_code | VARCHAR(50) | NULLable, UNIQUE | Mã số thuế. |
| nid | VARCHAR(50) | NULLable, UNIQUE | Số CMND/CCCD/Hộ chiếu. |
| source | VARCHAR(255) | NULLable | Nguồn dữ liệu. |
| description | TEXT | NULLable | Lý do white listing. |
| deleted | BOOLEAN | Default FALSE | Soft delete flag. |

CREATE TABLE white\_list (
    id VARCHAR(36) PRIMARY KEY,
    full\_name VARCHAR(255),
    company\_name VARCHAR(255),
    tax\_code VARCHAR(50) UNIQUE,
    nid VARCHAR(50) UNIQUE,
    source VARCHAR(255),
    description TEXT,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    created\_by VARCHAR(100),
    created\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP NOT NULL,
    updated\_by VARCHAR(100),
    updated\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP NOT NULL
);
CREATE INDEX idx\_white\_list\_tax\_code ON white\_list(tax\_code);
CREATE INDEX idx\_white\_list\_nid ON white\_list(nid);
CREATE INDEX idx\_white\_list\_deleted ON white\_list(deleted);

#### 5\. Bảng `case_details` (Chi tiết Case)

Lưu trữ chi tiết các kết quả screening/monitoring cho từng case.

| Field Name | Data Type | Constraints | Description |
| --- | --- | --- | --- |
| id | VARCHAR(36) | PK, NOT NULL | Định danh chi tiết case (UUID). |
| case_monitor_id | VARCHAR(36) | FK → case_monitors(id) | ID của case monitor. |
| risk_score | INTEGER | NULLable | Điểm rủi ro tính toán. |
| onboarding_data | JSONB | NULLable | Dữ liệu onboarding screening. |
| transaction_data | JSONB | NULLable | Dữ liệu transaction monitoring. |
| hit_data | JSONB | NULLable | Danh sách các hit (negative list, rules). |
| deleted | BOOLEAN | Default FALSE | Soft delete flag. |

CREATE TABLE case\_details (
    id VARCHAR(36) PRIMARY KEY,
    case\_monitor\_id VARCHAR(36) NOT NULL,
    risk\_score INTEGER,
    onboarding\_data JSONB,
    transaction\_data JSONB,
    hit\_data JSONB,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    created\_by VARCHAR(100),
    created\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP,
    updated\_by VARCHAR(100),
    updated\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP,
    CONSTRAINT fk\_case\_detail\_monitor FOREIGN KEY (case\_monitor\_id)
        REFERENCES case\_monitors(id)
);
CREATE INDEX idx\_case\_details\_monitor\_id ON case\_details(case\_monitor\_id);

#### 6\. Bảng `transaction_events` (Sự kiện Giao dịch)

Lưu trữ các sự kiện giao dịch để phục vụ monitoring và tracing.

| Field Name | Data Type | Constraints | Description |
| --- | --- | --- | --- |
| id | VARCHAR(36) | PK, NOT NULL | Định danh event (UUID). |
| transaction_id | VARCHAR(100) | Index | ID giao dịch từ hệ thống. |
| bank_transaction_id | VARCHAR(100) | Index | ID giao dịch ngân hàng. |
| txn_number | VARCHAR(100) | NULLable | Số giao dịch. |
| customer_id | VARCHAR(50) | Index | ID khách hàng. |
| customer_code | VARCHAR(50) | NULLable | Mã khách hàng. |
| customer_name | VARCHAR(255) | NULLable | Tên khách hàng. |
| from_account_no | VARCHAR(50) | NULLable | Số TK nguồn. |
| from_account_name | VARCHAR(255) | NULLable | Tên TK nguồn. |
| from_bank_type | VARCHAR(50) | NULLable | Loại ngân hàng nguồn. |
| to_account_no | VARCHAR(50) | NULLable | Số TK đích. |
| to_account_name | VARCHAR(255) | NULLable | Tên TK đích. |
| to_bank_type | VARCHAR(50) | NULLable | Loại ngân hàng đích. |
| amount | DECIMAL(19,2) | NOT NULL | Số tiền giao dịch. |
| currency | VARCHAR(10) | Default ‘VND’ | Loại tiền tệ. |
| transaction_type | VARCHAR(50) | NULLable | Loại giao dịch. |
| transaction_time | TIMESTAMP | NOT NULL | Thời gian giao dịch. |
| deleted | BOOLEAN | Default FALSE | Soft delete flag. |

CREATE TABLE transaction\_events (
    id VARCHAR(36) PRIMARY KEY,
    transaction\_id VARCHAR(100),
    bank\_transaction\_id VARCHAR(100),
    txn\_number VARCHAR(100),
    customer\_id VARCHAR(50),
    customer\_code VARCHAR(50),
    customer\_name VARCHAR(255),
    from\_account\_no VARCHAR(50),
    from\_account\_name VARCHAR(255),
    from\_bank\_type VARCHAR(50),
    to\_account\_no VARCHAR(50),
    to\_account\_name VARCHAR(255),
    to\_bank\_type VARCHAR(50),
    amount DECIMAL(19,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'VND',
    transaction\_type VARCHAR(50),
    transaction\_time TIMESTAMP NOT NULL,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    created\_by VARCHAR(100),
    created\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP,
    updated\_by VARCHAR(100),
    updated\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP
);
CREATE INDEX idx\_txn\_events\_transaction\_id ON transaction\_events(transaction\_id);
CREATE INDEX idx\_txn\_events\_customer\_id ON transaction\_events(customer\_id);
CREATE INDEX idx\_txn\_events\_transaction\_time ON transaction\_events(transaction\_time);

#### 7\. Bảng Scorecard (Đánh giá Rủi ro)

Hệ thống scorecard bao gồm 4 bảng liên kết theo cấu trúc phân cấp:

**7.1.** `scorecard_groups` **(Nhóm Scorecard)**

| Field Name | Data Type | Constraints | Description |
| --- | --- | --- | --- |
| id | VARCHAR(36) | PK, NOT NULL | Định danh duy nhất (UUID). |
| code | VARCHAR(50) | UNIQUE, NOT NULL | Mã nhóm scorecard. |
| name | VARCHAR(200) | NOT NULL | Tên nhóm. |
| group_type | VARCHAR(50) | NOT NULL | Loại: ONBOARDING, TRANSACTION. |
| description | TEXT | NULLable | Mô tả nhóm. |
| enabled | BOOLEAN | Default TRUE | Trạng thái kích hoạt. |
| order_index | INTEGER | NULLable | Thứ tự hiển thị. |
| deleted | BOOLEAN | Default FALSE | Soft delete flag. |

CREATE TABLE scorecard\_groups (
    id VARCHAR(36) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    group\_type VARCHAR(50) NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT TRUE NOT NULL,
    order\_index INTEGER,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    created\_by VARCHAR(100),
    created\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP,
    updated\_by VARCHAR(100),
    updated\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP
);

**7.2.** `scorecard_categories` **(Danh mục Scorecard)**

| Field Name | Data Type | Constraints | Description |
| --- | --- | --- | --- |
| id | VARCHAR(36) | PK, NOT NULL | Định danh duy nhất (UUID). |
| code | VARCHAR(50) | UNIQUE, NOT NULL | Mã danh mục. |
| group_id | VARCHAR(36) | FK → scorecard_groups | ID của scorecard group. |
| name | VARCHAR(200) | NOT NULL | Tên danh mục. |
| description | TEXT | NULLable | Mô tả danh mục. |
| enabled | BOOLEAN | Default TRUE | Trạng thái kích hoạt. |
| order_index | INTEGER | NULLable | Thứ tự hiển thị. |
| weight | DOUBLE | NULLable | Trọng số danh mục. |
| deleted | BOOLEAN | Default FALSE | Soft delete flag. |

CREATE TABLE scorecard\_categories (
    id VARCHAR(36) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    group\_id VARCHAR(36) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT TRUE NOT NULL,
    order\_index INTEGER,
    weight DOUBLE PRECISION,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    created\_by VARCHAR(100),
    created\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP,
    updated\_by VARCHAR(100),
    updated\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP,
    CONSTRAINT fk\_category\_group FOREIGN KEY (group\_id)
        REFERENCES scorecard\_groups(id)
);

**7.3.** `scorecard_criterias` **(Tiêu chí Đánh giá)**

| Field Name | Data Type | Constraints | Description |
| --- | --- | --- | --- |
| id | VARCHAR(36) | PK, NOT NULL | Định danh duy nhất (UUID). |
| code | VARCHAR(50) | UNIQUE, NOT NULL | Mã tiêu chí. |
| category_id | VARCHAR(36) | FK → scorecard_categories | ID của category. |
| name | VARCHAR(200) | NOT NULL | Tên tiêu chí. |
| description | TEXT | NULLable | Mô tả tiêu chí. |
| score | INTEGER | NOT NULL | Điểm số của tiêu chí. |
| enabled | BOOLEAN | Default TRUE | Trạng thái kích hoạt. |
| order_index | INTEGER | NULLable | Thứ tự hiển thị. |
| deleted | BOOLEAN | Default FALSE | Soft delete flag. |

CREATE TABLE scorecard\_criterias (
    id VARCHAR(36) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    category\_id VARCHAR(36) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    score INTEGER NOT NULL,
    enabled BOOLEAN DEFAULT TRUE NOT NULL,
    order\_index INTEGER,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    created\_by VARCHAR(100),
    created\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP,
    updated\_by VARCHAR(100),
    updated\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP,
    CONSTRAINT fk\_criteria\_category FOREIGN KEY (category\_id)
        REFERENCES scorecard\_categories(id)
);

**7.4.** `scorecard_configurations` **(Cấu hình Ngưỡng)**

| Field Name | Data Type | Constraints | Description |
| --- | --- | --- | --- |
| id | VARCHAR(36) | PK, NOT NULL | Định danh duy nhất (UUID). |
| code | VARCHAR(50) | UNIQUE, NOT NULL | Mã cấu hình. |
| cutoff_value | INTEGER | NOT NULL | Giá trị ngưỡng cắt. |
| operator | VARCHAR(20) | NOT NULL | Toán tử: GTE, LTE, EQ. |
| level | VARCHAR(20) | NOT NULL | Mức độ rủi ro: LOW, MEDIUM, HIGH. |
| description | TEXT | NULLable | Mô tả cấu hình. |
| deleted | BOOLEAN | Default FALSE | Soft delete flag. |

CREATE TABLE scorecard\_configurations (
    id VARCHAR(36) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    cutoff\_value INTEGER NOT NULL,
    operator VARCHAR(20) NOT NULL,
    level VARCHAR(20) NOT NULL,
    description TEXT,
    deleted BOOLEAN DEFAULT FALSE NOT NULL,
    created\_by VARCHAR(100),
    created\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP,
    updated\_by VARCHAR(100),
    updated\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP
);

#### 8\. Audit Fields (Common cho tất cả bảng)

Tất cả các entity đều kế thừa từ `AuditableEntity` và có các trường audit chung:

| Field Name | Data Type | Description |
| --- | --- | --- |
| deleted | BOOLEAN | Soft delete flag (Default: FALSE). |
| created_at | TIMESTAMP | Thời gian tạo record (Auto-generated). |
| updated_at | TIMESTAMP | Thời gian cập nhật cuối (Auto-updated). |
| created_by | VARCHAR(100) | User tạo record. |
| updated_by | VARCHAR(100) | User cập nhật cuối cùng. |

**Lợi ích:**

-   **Soft Delete**: Không xóa vật lý data, chỉ đánh dấu deleted = true
    
-   **Audit Trail**: Theo dõi ai tạo/sửa và khi nào
    
-   **Data Recovery**: Có thể khôi phục data đã “xóa”
    
-   **Compliance**: Đáp ứng yêu cầu audit và regulatory
    

### 5.2. Thiết kế APIs Endpoint

#### A. Rule Management APIs (REST - Dành cho CMS)

**1\. Create New Rule**

-   **Endpoint:** `POST /api/v1/rules`
    
-   **Description:** Tạo mới một Rule giám sát.
    
-   **Request Body:**
    

| Field | Type | Description |
| --- | --- | --- |
| name | String | Tên Rule. |
| priority | Integer | Độ ưu tiên (1-100). |
| definition | Object | Cấu trúc JSON của Rule (Conditions). |
| actions | Array | Danh sách hành động khi Trigger. |

{
  "name": "Structuring Check 1H",
  "priority": 90,
  "definition": {
    "condition": "AND",
    "rules": \[
      { "field": "amount", "operator": "<", "value": 50000000 },
      { "field": "count\_1h", "operator": ">=", "value": 10 }
    \]
  },
  "actions": \[{ "type": "CREATE\_CASE", "priority": "HIGH" }\]
}

-   **Response:** `201 Created` - `{ "rule_id": "uuid..." }`
    

**2\. Validate Rule**

-   **Endpoint:** `POST /api/v1/rules/validate`
    
-   **Description:** Kiểm tra cú pháp Rule mà không lưu (Dry-run).
    
-   **Request Body:** (Giống Create Rule)
    
-   **Response:** `200 OK` - `{ "valid": true, "estimated_cost": "low" }`
    

#### B. Screening & Monitoring Service (gRPC - Dành cho Merchant Portal Service và Transaction Core)

**Service Definition (Proto):**

service AmlService {
  rpc ScreenOnboarding(ScreenOnboardingRequest) returns (ScreenOnboardingResponse);
  rpc MonitoringTransaction(MonitoringTransactionRequest) returns (MonitoringTransactionResponse);
}

**1\. Screen Onboarding - Request Model (**`ScreenOnboardingRequest`**):**

| Field | Type | Description |
| --- | --- | --- |
| customer | CustomerInfo | Thông tin khách hàng/merchant. |
| metadata | google.protobuf.Struct | Dữ liệu bổ sung (optional). |

**CustomerInfo:**

| Field | Type | Description |
| --- | --- | --- |
| id | string | ID khách hàng. |
| code | string | Mã khách hàng. |
| name | string | Tên khách hàng. |
| avatar | string | Ảnh đại diện. |
| profile | ProfileInfo | Thông tin hồ sơ. |
| bank_accounts | BankAccountInfo[] | Danh sách tài khoản ngân hàng. |

**ProfileInfo:**

| Field | Type | Description |
| --- | --- | --- |
| business_type | BusinessType | PERSONAL hoặc ORGANIZATION. |
| full_name | string | Tên đầy đủ (cá nhân). |
| company_name | string | Tên công ty (doanh nghiệp). |
| email | string | Email liên hệ. |
| phone_number | string | Số điện thoại. |
| country | string | Quốc gia. |
| tax_code | string | Mã số thuế. |
| nid | string | Số CMND/CCCD/Hộ chiếu. |
| industry | string | Ngành nghề. |

**Screen Onboarding - Response Model (**`ScreenOnboardingResponse`**):**

| Field | Type | Description |
| --- | --- | --- |
| result_flag | string | GREEN, YELLOW, RED, NONE. |
| risk_score | int32 | Tổng điểm rủi ro tính toán. |
| risk_level | string | Mức độ rủi ro: LOW, MEDIUM, HIGH. |
| success | bool | Trạng thái thành công. |
| message | string | Thông điệp mô tả. |

**2\. Monitoring Transaction - Request Model (**`MonitoringTransactionRequest`**):**

| Field | Type | Description |
| --- | --- | --- |
| bank_transaction_id | string | ID giao dịch ngân hàng. |
| transaction_id | string | ID giao dịch hệ thống. |
| txn_number | string | Số giao dịch. |
| customer_id | string | ID khách hàng. |
| customer_code | string | Mã khách hàng. |
| customer_name | string | Tên khách hàng. |
| from_account_no | string | Số TK nguồn. |
| from_account_name | string | Tên TK nguồn. |
| from_bank_type | string | Loại ngân hàng nguồn. |
| to_account_no | string | Số TK đích. |
| to_account_name | string | Tên TK đích. |
| to_bank_type | string | Loại ngân hàng đích. |
| amount | int64 | Số tiền (VND). |
| currency | string | Loại tiền tệ. |
| transaction_type | string | Loại giao dịch. |
| transaction_time | int64 | Timestamp (milliseconds). |
| metadata | google.protobuf.Struct | Dữ liệu bổ sung. |

**Monitoring Transaction - Response Model (**`MonitoringTransactionResponse`**):**

| Field | Type | Description |
| --- | --- | --- |
| success | bool | Trạng thái thành công. |
| message | string | Thông điệp mô tả. |

#### C. Case Monitor Management APIs (REST - Dành cho CMS)

**1\. Get List Case Monitors**

-   **Endpoint:** `GET /api/case-monitors/v1/get-list`
    
-   **Query Params:** `keyword`, `status`, `type`, `page`, `size`.
    
-   **Response:**
    

| Field | Type | Description |
| --- | --- | --- |
| data | Array | Danh sách Case Monitor Objects. |
| meta | Object | Pagination info. |

**2\. Get Case Monitor Detail**

-   **Endpoint:** `GET /api/case-monitors/v1/detail/{id}`
    
-   **Path Params:** `id` - Case Monitor ID.
    
-   **Response:**
    

| Field | Type | Description |
| --- | --- | --- |
| id | String | ID của case monitor. |
| customer_id | String | ID khách hàng. |
| monitor_type | String | Loại giám sát. |
| status | String | Trạng thái case. |
| result | String | Kết quả đánh giá. |
| risk_score | Integer | Điểm rủi ro. |
| risk_level | String | Mức độ rủi ro. |
| case_detail | Object | Chi tiết case (hit data, screening). |

**3\. Export Case Monitors**

-   **Endpoint:** `GET /api/case-monitors/v1/export`
    
-   **Query Params:** `keyword`, `status`, `type`, `from_date`, `to_date`.
    
-   **Response:** Excel/CSV file download.
    

#### D. Negative List Management APIs (REST - Dành cho CMS)

**1\. Import Negative List**

-   **Endpoint:** `POST /api/negatives/v1/import`
    
-   **Content-Type:** `multipart/form-data`
    
-   **Request Body:**
    

| Field | Type | Description |
| --- | --- | --- |
| file | File | File Excel/CSV import |

**2\. Get Negative Lists**

-   **Endpoint:** `GET /api/negatives/v1/get-list`
    
-   **Query Params:** `keyword`, `negative_type`, `page`, `size`.
    
-   **Response:**
    

| Field | Type | Description |
| --- | --- | --- |
| data | Array | Danh sách Negative Objects. |
| meta | Object | Pagination info. |

**3\. Export Negative List**

-   **Endpoint:** `GET /api/negatives/v1/export`
    
-   **Query Params:** `negative_type`, `from_date`, `to_date`.
    
-   **Response:** Excel file download.
    

#### E. Rule Management APIs (REST - Dành cho CMS)

**1\. Create Rules**

-   **Endpoint:** `POST /api/rules/v1/create`
    
-   **Request Body:**
    

| Field | Type | Description |
| --- | --- | --- |
| name | String | Tên Rule. |
| description | String | Mô tả Rule. |
| definition | Object | Cấu trúc AST Node của Rule. |
| actions | Array | Danh sách actions. |
| type | String | ONBOARDING_SCORING / TRANSACTION_MONITORING. |

**2\. Get All Rules**

-   **Endpoint:** `GET /api/rules/v1/get-all`
    
-   **Query Params:** `page`, `size`.
    
-   **Response:**
    

| Field | Type | Description |
| --- | --- | --- |
| data | Array | Danh sách Rules. |
| meta | Object | Pagination info. |

**3\. Execute Rules (Testing)**

-   **Endpoint:** `POST /api/rules/v1/execute`
    
-   **Request Body:**
    

| Field | Type | Description |
| --- | --- | --- |
| rules | Array | Danh sách rules cần test. |
| inputs | Object | Dữ liệu đầu vào để test rule. |

#### F. Scorecard Management APIs (REST - Dành cho CMS)

**1\. Get List Scorecard Groups**

-   **Endpoint:** `GET /api/scorecards/group/v1/get-list`
    
-   **Query Params:** `group_type`, `enabled`, `page`, `size`.
    
-   **Response:**
    

| Field | Type | Description |
| --- | --- | --- |
| data | Array | Danh sách Scorecard Group Objects. |
| meta | Object | Pagination info. |

**2\. Toggle Scorecard Group**

-   **Endpoint:** `PUT /api/scorecards/group/v1/toggle`
    
-   **Request Body:**
    

| Field | Type | Description |
| --- | --- | --- |
| group_id | String | ID của scorecard group. |
| enabled | Boolean | Trạng thái kích hoạt mới. |

**3\. Update Scorecard Criteria**

-   **Endpoint:** `PUT /api/scorecards/criteria/v1/update`
    
-   **Request Body:**
    

| Field | Type | Description |
| --- | --- | --- |
| criteria_id | String | ID của criteria. |
| name | String | Tên mới (optional). |
| description | String | Mô tả mới (optional). |
| score | Integer | Điểm mới (optional). |
| enabled | Boolean | Trạng thái mới (optional). |

### 5.3. Define Common Models

#### 5.3.1 Result Mapping

| Result | Description |
| --- | --- |
| NONE | Chưa có kết quả |
| GREEN | Thông tin screen sạch - An toàn |
| YELLOW | Thông tin screen HIT - Cần được review |
| RED | Thông tin screen failed - Từ chối |

#### 5.3.2 Risk Level Mapping

| Risk Level | Description |
| --- | --- |
| LOW | Rủi ro thấp |
| MEDIUM | Rủi ro trung bình |
| HIGH | Rủi ro cao |

#### 5.3.3 Case Monitor Status

| Status | Description |
| --- | --- |
| OPEN | Case mới tạo, chưa xử lý |
| INVESTIGATING | Đang điều tra |
| CLOSED | Đã đóng case |

#### 5.3.4 Monitor Type

| Type | Description |
| --- | --- |
| ONBOARDING | Giám sát khi khách hàng đăng ký |
| TRANSACTION | Giám sát giao dịch |

#### 5.3.5 Negative Type

| Type | Description |
| --- | --- |
| BLACKLIST | Danh sách đen |
| SANCTION | Danh sách trừng phạt |
| PEP | Cá nhân có ảnh hưởng chính trị |
| SIP | Danh sách cá nhân quan tâm đặc biệt |
| NEGATIVE_NEWS | Tin tức tiêu cực |

#### 5.3.6 Rule Type

| Type | Description |
| --- | --- |
| ONBOARDING_SCORING | Rule đánh giá điểm onboarding |
| TRANSACTION_MONITORING | Rule giám sát giao dịch |

#### 5.3.7 Common Error Codes

| Error Code | HTTP Status | Description | Action |
| --- | --- | --- | --- |
| AML-1001 | 400 | Rule Syntax Error: Cú pháp JSON Rule không hợp lệ. | Kiểm tra lại cấu trúc JSON hoặc Operator. |
| AML-1002 | 400 | Missing Metrics: Rule yêu cầu metric không được hỗ trợ. | Chọn metric có sẵn trong danh sách. |
| AML-2001 | 404 | Merchant Not Found: Không tìm thấy thông tin Merchant để screen. | Kiểm tra lại ID đầu vào. |
| AML-3001 | 409 | Case Status Conflict: Không thể đóng Case đang ở trạng thái CLOSED. | Refresh lại trang CMS. |
| AML-5001 | 500 | Internal Error: Lỗi hệ thống (DB, Redis). | Liên hệ đội kỹ thuật (Retryable). |

## 6\. Phụ lục tài liệu

-   [PRD Module: Phòng chống rửa tiền(AML)](/wiki/spaces/MSN/pages/141131780/PRD+-+Ph+ng+ch+ng+r+a+ti+n+AML) <!-- Confluence Page ID: 141131780 -->
