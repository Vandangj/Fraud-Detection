<div align="center">

# FINANCIAL FRAUD DETECTION SYSTEM

<br>

### A MINI PROJECT REPORT
*submitted in partial fulfillment of the requirements for the award of the degree of*  
**Bachelor of Technology in Computer Engineering**

<br>

*Submitted by*

| Student Name | UID Number |
| :--- | :--- |
| **Vandan Jethwa** | 2024300096 |
| **Soham Gurav** | 2024300075 |
| **Kushal Karkal** | 2024300106 |

<br>

*Under the Guidance of*  
**Prof. Reeta Koshy**  
*(Assistant Professor, Department of Computer Engineering)*

<br>
<br>

**Department of Computer Engineering**  
**Bharatiya Vidya Bhavan's Sardar Patel Institute of Technology**  
*(Autonomous Institute Affiliated to University of Mumbai)*  
Munshi Nagar, Andheri (West), Mumbai – 400058  

**Academic Year 2026–2027**  
**Semester V**

</div>

<div style="page-break-after: always; break-after: page;"></div>

## Certificate

This is to certify that the Mini Project entitled **"Financial Fraud Detection System"** is a bonafide work carried out by:

<div align="center">

| Student Name | UID Number |
| :--- | :--- |
| **Vandan Jethwa** | 2024300096 |
| **Soham Gurav** | 2024300075 |
| **Kushal Karkal** | 2024300106 |

</div>

submitted in partial fulfillment of the requirement for the award of the Degree of **Bachelor of Technology in Computer Engineering** from the **University of Mumbai** under the guidance of **Prof. Reeta Koshy** during the academic year 2026–2027.

<br>
<br>

| Role | Signatory | Signature |
| :--- | :--- | :--- |
| **Project Guide** | Prof. Reeta Koshy | _________________________ |
| **Head of Department** | Dr. Manish Potey | _________________________ |
| **Principal** | Dr. Prachi Gharpure | _________________________ |

<br>

**Date:** October 2026 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; **Place:** Mumbai

<div style="page-break-after: always; break-after: page;"></div>

## Approval Certificate

This is to certify that the Mini Project entitled **"Financial Fraud Detection System"** by **Vandan Jethwa**, **Soham Gurav**, and **Kushal Karkal** is approved for the partial fulfillment of the Mini Project of T.E. Computer Engineering from the University of Mumbai.

<br>

**Examiners:**

| Role | Name | Signature & Date |
| :--- | :--- | :--- |
| **Internal Examiner (Guide)** | Prof. Reeta Koshy | _________________________ |
| **External Examiner** | _________________________ | _________________________ |

<br>

**Institutional Authorities:**

| Role | Signatory | Signature |
| :--- | :--- | :--- |
| **Head of Department** | Dr. Manish Potey | _________________________ |
| **Principal** | Dr. Prachi Gharpure | _________________________ |

<br>

**Seal of the Institute:**

<br>
<br>

**Date:** October 2026 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; **Place:** Mumbai

<div style="page-break-after: always; break-after: page;"></div>

## Declaration

We declare that the work embodied in this report titled **"Financial Fraud Detection System"** is our own contribution, carried out under the guidance of **Prof. Reeta Koshy** at Sardar Patel Institute of Technology. This written submission represents our ideas in our own words, and where the ideas or words of others have been included, we have adequately cited and referenced the original sources.

We also declare that we have adhered to all principles of academic honesty and integrity and have not misrepresented, fabricated, or falsified any idea, data, fact, or source. Features are reported as implemented, and results as obtained, only where supporting evidence exists. Anything proposed but not verified is stated as such.

<br>

| Student Name | UID Number | Signature |
| :--- | :--- | :--- |
| **Vandan Jethwa** | 2024300096 | _________________________ |
| **Soham Gurav** | 2024300075 | _________________________ |
| **Kushal Karkal** | 2024300106 | _________________________ |

<br>

**Date:** October 2026 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; **Place:** Mumbai

<div style="page-break-after: always; break-after: page;"></div>

## Acknowledgement

We express our sincere gratitude to our project guide, Prof. Reeta Koshy, for her guidance, regular feedback and encouragement throughout this mini project. Her questions during the reviews helped us sharpen the problem definition and the design.

We thank the Head of the Department of Computer Engineering and the Principal of Sardar Patel Institute of Technology for the facilities and academic environment. We also thank the faculty of the department, whose teaching in the earlier semesters supplied the foundations this project builds on, and our classmates for their suggestions during demonstrations.

<div style="page-break-after: always; break-after: page;"></div>

## Abstract

**Problem.** Fraudulent transactions are a very small fraction of all financial transactions. This makes them hard to find by manual review or fixed rules, and it makes plain accuracy a misleading measure. Analysts also need to know why a transaction was flagged before they act on it.

**Objective and solution.** This project builds a web-based Financial Fraud Detection System that scores every transaction with a machine learning model, flags transactions whose score reaches a tuned cutoff, raises alerts for high-risk cases and explains each flag to the analyst. Five classifiers (Logistic Regression baseline, Random Forest with SMOTE, Gradient Boosting, LightGBM and XGBoost) are trained and compared, and one is set as the active model.

**Technologies and features.** The backend uses FastAPI with MySQL through SQLAlchemy. Models are built with scikit-learn based libraries, and TreeSHAP gives feature-level explanations. The dashboard has seven pages: Overview, Transactions, Alerts, Cases and SHAP, Model Health, DB Tables Explorer, and Admin and Users. Two roles, Analyst and Admin, control access, and passwords are stored only as hashes. Training uses an 80:20 stratified split, SMOTE on the training data only, and a fixed decision threshold of 0.30.

**Testing and results.** Testing covers unit, integration, functional, non-functional, boundary and invalid-input stages, with test cases mapped to requirement IDs. The best-performing model is RandomForestClassifier (SMOTE) with F1-score 0.9970, ROC-AUC 0.9984, training in 1.98 s and inference latency of 0.003 ms per query. All four tree-based models exceeded 0.99 F1-score, significantly outperforming the Logistic Regression baseline (F1 = 0.7983).

**Applicability and limitations.** The system suits analysts who review suspicious transactions. It runs on a single local machine over a historical dataset and does not process real payments or connect to real banks.

<div style="page-break-after: always; break-after: page;"></div>

## List of Abbreviations and Symbols

| Term | Meaning |
|---|---|
| API | Application Programming Interface |
| AUC | Area Under the Curve |
| CRUD | Create, Read, Update, Delete |
| CSV | Comma-Separated Values |
| DFD | Data Flow Diagram |
| ER | Entity-Relationship |
| FR / NFR | Functional / Non-Functional Requirement |
| F1 | Harmonic mean of precision and recall |
| JSON | JavaScript Object Notation |
| KPI | Key Performance Indicator |
| ORM | Object-Relational Mapping |
| RBAC | Role-Based Access Control |
| REST | Representational State Transfer |
| ROC | Receiver Operating Characteristic |
| SHAP | SHapley Additive exPlanations |
| SMOTE | Synthetic Minority Over-sampling Technique |
| SRS | Software Requirements Specification |
| UML | Unified Modeling Language |
| s | Fraud score of a transaction, 0 ≤ s ≤ 1 |
| τ (tau) | Decision threshold (cutoff = 0.30); flagged when s ≥ τ |
| n, d | Number of training rows, number of features |
| T, D, L | Number of trees, maximum depth, maximum leaves per tree |


<div style="page-break-after: always; break-after: page;"></div>

## Chapter 1: Introduction and Problem Definition

### 1.1 Project Background

Financial institutions process very large numbers of transactions every day. A very small share is fraudulent, but each fraudulent transaction can cause direct loss to the account holder and the institution. Reviewing every transaction by hand is not possible, and fixed rules such as "flag every amount above a limit" are easy to bypass and produce many false alarms.

Machine learning can learn the patterns of fraud from historical labelled transactions and give each new transaction a fraud score. Two difficulties remain. First, fraud data is highly imbalanced, so a model can reach high accuracy by predicting every transaction as genuine. Second, a bare score is not enough for an analyst, who must decide whether to block a transaction and needs the reasons behind the score.

### 1.2 Problem Statement

To design and build a web-based system that scores every financial transaction for fraud using machine learning, flags transactions that reach a decision threshold, raises alerts for high-risk cases, explains each flag with feature-level contributions, and lets an analyst record a decision on the case.

The difficulties with existing approaches are: manual review does not scale; rule-based filters are rigid; a single model trained without care for class imbalance gives misleading accuracy; and many models are black boxes, so analysts cannot justify their decisions.

### 1.3 Motivation

The cost of a missed fraud is much higher than the cost of reviewing a genuine transaction, and the skewed data makes the problem technically interesting. Fraud analysts benefit from a ranked and explained list instead of a raw ledger. Administrators can compare models and retrain them. Account holders are indirectly protected from loss.

### 1.4 Objectives

- **O1.** Store transactions in MySQL and let users add, search, filter, flag and delete them.
- **O2.** Preprocess each transaction exactly as the training data and give it a fraud score between 0 and 1 using the active model.
- **O3.** Train and compare five classifiers on accuracy, precision, recall, F1-score, ROC-AUC, inference latency and training time.
- **O4.** Use an 80:20 stratified split, apply SMOTE to training data only, and use a fixed decision threshold of 0.30.
- **O5.** Flag transactions at or above the cutoff and raise alerts for high-risk cases.
- **O6.** Explain every flagged transaction using TreeSHAP and let an analyst record Confirm Fraud, Mark Legit or In Review with notes.
- **O7.** Provide Admin and Analyst roles with role-based access control and hashed passwords.
- **O8.** Provide a database explorer with search, filtering, paging and CSV or JSON export.

### 1.5 Scope of the Project

**Included:** transaction management; fraud prediction with a score; case investigation with explanations; alerts for high-risk transactions; model comparison, active-model selection, cutoff adjustment and retraining; database explorer; user management with role-based access.

**Outside scope:** real payment processing and integration with real banks; live streaming ingestion from payment networks; automated blocking of real accounts.

**Intended users:** Analysts, who investigate flagged transactions, and Admins, who also manage models and users. No ML knowledge is needed.

**Operating environment:** a single local machine running the FastAPI backend, a MySQL server and a web browser.

**Expected scale:** a historical dataset of **6,362,620 transactions** (8,213 fraudulent, 0.13% fraud rate) loaded into MySQL and a small number of concurrent users.

### 1.6 Proposed Solution

The system is one connected product: a web dashboard (React + Vite), a FastAPI backend, a MySQL database, a preprocessing module, a multi-model classification module, an explainability module, an alert module and a user management module. When an analyst adds a transaction, the backend validates it, preprocesses it, scores it with the active model, compares the score with the cutoff (0.30), stores the transaction and prediction, and raises an alert if it is flagged. When the analyst opens the case, TreeSHAP shows which features raised or lowered the score, and the analyst records a decision. An Admin can compare the five models, change the active model, move the cutoff and retrain.

### 1.7 Novelty and Originality

The project does not claim a new learning algorithm. Its contribution lies in the engineering and workflow:

- One workflow joining scoring, alerting, explanation and analyst decision, with every prediction stored with the model used, score, threshold and time.
- A fair multi-model comparison under one split, with SMOTE kept out of the test data.
- A Model Health page where an Admin switches the active model, moves the cutoff with a slider and retrains without changing code.
- A modular design where a model can be added or replaced without touching other modules.

### 1.8 Feasibility Analysis

- **Technical:** all components are open source and well documented (FastAPI, MySQL, SQLAlchemy, scikit-learn, XGBoost, LightGBM, SHAP). The team has implemented the system with them.
- **Economic:** no licensed software or paid cloud service is needed; the cost is the team's time.
- **Operational:** a seven-page dashboard with a navigation menu, needing no ML knowledge. Roles keep screens simple for analysts.
- **Time and resources:** the work fits in one semester because the dataset is historical, infrastructure is local, and the five models share one training pipeline.

### 1.9 Social Relevance and Practical Applications

Reducing undetected fraud protects ordinary account holders. Explained flags make review more transparent, which matters when a customer's transaction is blocked. Practical uses include a review desk at a bank or payment company, a teaching tool for fraud analytics, and a base for comparing models on imbalanced data.

### 1.10 Success Criteria and Key Performance Indicators

Targets are proposed before testing and compared with measured values in Section 9.10.

| KPI | Definition | Target (proposed) | Measurement |
|---|---|---|---|
| Response time | Time to validate, score and store one transaction | ≤ 2 s | Timestamps around the API call |
| Functional correctness | Passed test cases / total | 100% of defined cases | Test execution (Chapter 9) |
| Reliability | Invalid inputs handled without a crash / invalid inputs tried | 100% | Invalid-input tests |
| Model quality | F1-score and ROC-AUC of the active model on the held-out test set | Better F1 than the Logistic Regression baseline (0.7983) | Evaluation on the 20% test split |
| Explanation coverage | Flagged transactions showing TreeSHAP contributions | 100% for tree-based active models | Functional tests |
| Resource use | CPU and memory during scoring and training | Within standard laptop capacity | System monitor |


<div style="page-break-after: always; break-after: page;"></div>

## Chapter 2: Literature Review and Study of Existing Systems

### 2.1 Study of Existing Systems

**Manual review.** Analysts inspect transactions or customer complaints directly. This is accurate for the cases reviewed but cannot cover the volume.

**Rule-based engines.** Fixed rules on amount, velocity or location flag transactions. They are transparent and fast, but need constant tuning, and fraudsters learn to stay below the limits.

**Single-model ML pipelines.** One classifier, often a Random Forest or boosted trees, is trained on historical data to produce a score. Many academic projects follow this pattern and stop at the model, without an analyst workflow.

**Commercial fraud platforms.** Vendors such as FICO Falcon Fraud Manager and Featurespace ARIC provide full products with scoring, case management and reporting. They are proprietary and costly, and their internals are closed.

### 2.2 Review of Research Papers and Technical Resources

| Source | Contribution | Use in this project |
|---|---|---|
| Dal Pozzolo et al. [1] | Realistic modelling of credit card fraud detection, covering class imbalance, evaluation and cost of errors | Motivates stratified splitting and not relying on accuracy |
| Chawla et al. [2] | SMOTE creates synthetic minority samples by interpolating between neighbours | Balances the training split only |
| Breiman [3] | Random Forests: bagged, decorrelated trees | Random Forest model |
| Friedman [4] | Gradient boosting machines: trees added stage-wise to reduce loss | Gradient Boosting model |
| Chen and Guestrin [5] | XGBoost: regularized, scalable tree boosting | XGBoost model |
| Ke et al. [6] | LightGBM: histogram-based boosting with leaf-wise growth | LightGBM model |
| Lundberg and Lee [7] | SHAP: additive feature attribution from Shapley values | Explaining scores |
| Lundberg et al. [8] | TreeSHAP: exact, fast explanations for tree ensembles | Per-transaction explanations |
| Saito and Rehmsmeier [9] | Precision-recall plots are more informative than ROC on imbalanced data | Precision-recall curve on Model Health page |
| Pedregosa et al. [10] | scikit-learn library | Preprocessing, split, metrics, models |

### 2.3 Comparative Analysis

| Criterion | Manual review | Rule engine | Single ML model | Proposed system |
|---|---|---|---|---|
| Scales to volume | No | Yes | Yes | Yes |
| Adapts to new patterns | Slowly | Needs manual rules | On retraining | On retraining |
| Handles class imbalance | Not applicable | Not applicable | Often ignored | SMOTE on training data and fixed cutoff |
| Explains a flag | Yes, by hand | Yes, by rule | Usually no | TreeSHAP per transaction |
| Compares models | No | No | No | Five models |
| Analyst workflow | Informal | Limited | Usually absent | Case view and decisions |
| Cost | High staff cost | Low | Low | Low (open source) |

### 2.4 Limitations of Existing Systems

Rules are brittle. Single models are rarely compared with alternatives and are often judged on accuracy. Explanations are missing or separated from the review workflow. Complete platforms are closed and costly, so students and small teams cannot study them.

### 2.5 Identified Research or Engineering Gap

There is a gap between a trained fraud model and a tool an analyst can use. Models give scores, but analysts need ranked alerts, reasons, a place to record decisions, and a way to see how each model performs. An open, modular system that includes all of these is the gap this project fills.

### 2.6 Proposed Improvements

The system fills the gap by comparing five models under one protocol, using a tuned cutoff, storing every prediction with its context, explaining flagged transactions, and giving Analysts and Admins separate screens for review and for model management.


<div style="page-break-after: always; break-after: page;"></div>

## Chapter 3: Software Requirements Specification (SRS)

### 3.1 Purpose and Scope of the SRS

This chapter specifies the requirements of the Financial Fraud Detection System so it can be designed, implemented and tested against a common reference. The scope is the one defined in Section 1.5. The full SRS (version 1.0) is kept as a separate document and summarized here.

### 3.2 Intended Users and Stakeholders

- **Analyst:** investigates flagged transactions, reads explanations and records decisions.
- **Admin:** has every Analyst right and also retrains models, selects the active model, changes the cutoff and manages users.
- **Project team and guide:** design, build and evaluate the system.

### 3.3 Overall Product Description

The product is a web application. The React dashboard (built with Vite) calls REST APIs of a FastAPI backend. The backend reads and writes MySQL through SQLAlchemy, calls the preprocessing module and the active model for scoring, and calls TreeSHAP for explanations. Models are trained offline by an Admin and loaded by the backend. The main dependencies are the labelled historical dataset, the trained models and a running MySQL server. New transactions use the same fields as the training data: sender account, destination account, amount, transaction type, step, old balance and new balance.

### 3.4 Functional Requirements

The system requirements are organized into 13 primary functional requirements covering end-to-end security, transaction processing, machine learning inference, explainability, alert triage, model governance, and administrative oversight.

| Req ID | Requirement Title & Description | Input | Processing and System Output | Acceptance Criteria |
|---|---|---|---|---|
| **FR-01** | **User Authentication & Session Management**: Secure user authentication mechanism with password hashing and session management. | Username and plaintext password | Cryptographic verification via SHA-256 / bcrypt hash against database; issuance of authenticated session state. | Valid credentials authenticate and grant dashboard access; invalid credentials return HTTP 401 error and deny access. |
| **FR-02** | **Role-Based Access Control (RBAC)**: Strict segregation of duties between Admin and Analyst roles. | Authenticated session token and requested endpoint | Validation of user role (`admin` vs `analyst`) against endpoint authorization policy before execution. | Admin has complete access to user management, model switching, and retraining; Analyst is restricted to review queues and case detail. |
| **FR-03** | **Transaction Ingestion & Feature Preprocessing**: Accept and preprocess transaction data consistently with the ML pipeline. | Raw transaction parameters (`step`, `type`, `amount`, `oldbalanceOrg`, `newbalanceOrig`, `oldbalanceDest`, `newbalanceDest`) | Feature transformation (one-hot encoding of transaction types, mathematical balance error feature extraction) to produce standard 10-feature vector. | Generates standardized numerical feature array matching training pipeline schema and column ordering exactly. |
| **FR-04** | **Defensive Input Validation**: Enforce boundary conditions and data integrity on all submitted records. | Transaction form inputs or API payload | Schema validation verifying data types, required fields, and non-negative constraints (`amount > 0`, balances >= 0). | Valid payloads pass to processing pipeline; malformed or negative inputs immediately trigger HTTP 422 error without DB entry. |
| **FR-05** | **Real-Time Fraud Scoring & Threshold Flagging**: Evaluate transaction risk probability and apply tuned decision threshold. | Preprocessed feature vector and operational cutoff threshold (tau = 0.30) | Active classifier inference via `predict_proba`; score evaluation against threshold cutoff tau. | Generates continuous probability s in [0.0, 1.0]; marks transaction as suspicious if s >= 0.30, normal if s < 0.30. |
| **FR-06** | **Automated Alert Generation & Triage**: Automatic alert creation for high-risk transactions with severity classification. | Flagged transaction record and computed risk score | Generation of alert entity; severity assignment (`critical` for s >= 0.80, `warning` for 0.30 <= s < 0.80); status initialized to `new`. | Alert appears in alerts queue immediately; allows filtering by severity (Critical, Warning, Resolved) and status changes. |
| **FR-07** | **Explainable AI via TreeSHAP**: Provide local feature attribution explaining why a transaction was flagged. | Flagged transaction feature vector and active tree model | TreeSHAP explainer execution computing base expected value and per-feature directional Shapley contributions. | Returns top contributing risk factors explaining exact reasons driving the score up or down. |
| **FR-08** | **Case Review & Decision Recording**: Interactive analyst review workflow with persistent adjudication and audit logging. | Case identifier, review decision (`Confirm Fraud`, `Mark Legit`, `In Review`), and analyst notes | Update transaction status and alert state in database; store investigator audit trail with user ID and timestamp. | Updated status persists in database and interface; confirmed fraud blocks transaction; complete audit log preserved. |
| **FR-09** | **Multi-Model Benchmark & Tracking**: Train, evaluate, and benchmark five distinct machine learning algorithms. | Historical synthetic financial dataset with SMOTE balancing on training split | Train Logistic Regression, Random Forest, GBDT, LightGBM, and XGBoost; compute F1, ROC-AUC, Precision, Recall, Accuracy, Latency. | System maintains performance metrics for all five models; displays comparative scorecard with top performers highlighted. |
| **FR-10** | **Dynamic Active Model Management**: Administrative dynamic model selection without service disruption. | Administrator model selection (e.g., `rf-balanced-v1`, `lgb-fast-v1`, `xgb-robust-v1`) | Update active model configuration in database/registry; hot-reload model artifact in inference service. | Subsequent transaction scoring requests immediately use the newly activated model; change confirmed in UI and logs. |
| **FR-11** | **Automated Model Retraining Pipeline**: Administrative workflow for scheduled or on-demand model retraining and versioning. | Trigger retrain command and source model parameters | Execute training pipeline on current dataset; compute test metrics; persist new `.pkl` artifact; log to retraining history. | Retrained model receives incremented version ID (e.g., `v2`); evaluation metrics recorded; available for activation. |
| **FR-12** | **Executive Analytics & KPI Dashboard**: Real-time aggregated portfolio metrics and risk distribution visualization. | Transaction, prediction, and alert tables | Aggregate total transaction volume, flagged count, fraud rate percentage; render score distribution histogram with threshold line. | Overview screen renders up-to-date KPI metric cards, score distribution chart with 0.30 cutoff line, and quick-action alerts list. |
| **FR-13** | **Data Explorer, Filtering & Export**: Administrative data exploration tools with multi-column filtering, search, pagination, and data export. | Table selection, search query, filter criteria, format choice (CSV/JSON) | Server-side paginated queries; serialized structured file generation. | Table displays matching rows with responsive pagination; CSV or JSON file downloads with exact filtered dataset. |

### 3.5 Non-Functional Requirements

| Attribute | Requirement |
|---|---|
| Performance | A single prediction returns quickly enough for interactive use (< 2 s); ledger search and filters respond without noticeable delay on the project dataset. |
| Scalability | Sized for a single-machine student deployment; larger workloads are future work. |
| Availability and reliability | Invalid input never crashes the system and stored transactions are not lost. |
| Security and privacy | Passwords stored as hashes; access depends on role; database credentials are kept in `.env` file outside the code and the interface. |
| Usability | Analysts can review transactions and read explanations without ML knowledge; each page is reachable from the menu and the active model is shown in the header. |
| Maintainability | Separate modules so a model can be added or replaced. |
| Portability | Runs on a standard computer with Python 3.11+ and MySQL installed. |
| Resource utilization | No special hardware; CPU and memory measured during scoring and training. |

### 3.6 Hardware and Software Requirements

| Item | Details |
|---|---|
| Language | Python 3.11.9 |
| Backend | FastAPI (served via Uvicorn) |
| Database | MySQL, accessed with SQLAlchemy ORM via PyMySQL driver |
| ML libraries | scikit-learn, XGBoost, LightGBM, imbalanced-learn (SMOTE), SHAP (TreeSHAP) |
| Frontend | React 18 web dashboard with Vite 5, TailwindCSS 3, calling REST APIs |
| Hardware | Standard laptop (Windows 11, x64) |
| Version control | Git (GitHub) |

### 3.7 Constraints and Assumptions

**Constraints:** the backend uses FastAPI and the database is MySQL; the system is developed and evaluated on a historical dataset (PaySim); it runs on a local machine; the work must fit in one semester.

**Assumptions:** a labelled historical dataset is available and loaded into MySQL; new transactions have the same fields as the training data; the trained models are available when the backend starts.

### 3.8 Use Cases and User Stories

- As an Analyst, I want to add a transaction and see its score at once, so that I know whether it needs review.
- As an Analyst, I want to see why a transaction was flagged, so that I can justify my decision.
- As an Analyst, I want to filter alerts by severity, so that I handle the critical ones first.
- As an Admin, I want to compare the five models and choose the active one, so that scoring uses the best model for our needs.
- As an Admin, I want to move the cutoff and retrain, so that I can trade missed fraud against false alarms.
- As an Admin, I want to manage users and roles, so that only authorized people have access.

The use case diagram is given in Section 4.5 (Figure 4.5).


<div style="page-break-after: always; break-after: page;"></div>

## Chapter 4: System Architecture and Design

### 4.1 Overall System Architecture

The web dashboard (7 pages in React + Vite) calls the FastAPI backend over REST. The backend, which handles validation, roles, alerts and users, talks to three components: the MySQL database (users, transactions, models, frauds, alerts, retraining_history, drift_reports), the preprocessor with the five classifiers, and the TreeSHAP explainer.

![Figure 4.1: System Architecture Block Diagram](C:/Users/vandan/.gemini/antigravity-ide/brain/98eafd6a-f1ab-432d-b1e7-19ab8899a59d/system_architecture_1793023963321.jpg)

### 4.2 Component and Module Description

| Module | Purpose | Input / output | Depends on |
|---|---|---|---|
| Web dashboard | Seven pages for review and administration | User actions / REST calls | Backend |
| Backend API | Validation, role checks, routing, alerts | HTTP requests / JSON | All modules |
| Authentication and users | Login, hashes, roles | Credentials / session, role | Database |
| Preprocessor | Same feature preparation for training and scoring | Raw fields / feature vector (14 features) | scikit-learn, pandas |
| Model manager | Train, tune cutoff, evaluate, save, select active model | Dataset / models and metrics | Preprocessor, database |
| Predictor | Score a transaction and compare with cutoff | Feature vector / score, status | Active model |
| Explainer | Feature contributions for a score | Model, vector / SHAP values | SHAP library |
| Alert module | Create, filter and acknowledge alerts | Flagged transaction / alert | Database |
| Case module | Case view and analyst decision | Transaction ID, decision / updated status | Explainer, database |
| DB explorer | Browse, search, export tables | Table, query / rows, files | Database |

### 4.3 Architecture Selection and Justification

A layered client-server architecture with a modular backend was chosen. The presentation layer (React dashboard), service layer (FastAPI) and data layer (MySQL and model `.pkl` files) can change independently. REST over HTTP is simple to test and fits browser clients. Keeping the preprocessor, models and explainer as separate modules lets a model be added or replaced without changing the API. An event-driven design was not chosen because the project handles one interactive request at a time and does not consume a live stream.

### 4.4 Data Flow Diagram

**Level 0 (context):** the Analyst sends transactions and decisions to the system and receives scores, alerts and explanations. The Admin sends retrain commands, user changes and cutoff changes and receives metrics. The system reads and writes the database and model files.

![Figure 4.2: Level 0 Context DFD](C:/Users/vandan/.gemini/antigravity-ide/brain/98eafd6a-f1ab-432d-b1e7-19ab8899a59d/dfd_level0_1793024009948.jpg)

**Level 1:** processes are 1 Authenticate, 2 Validate and preprocess, 3 Score and flag, 4 Raise alert, 5 Investigate and decide, 6 Manage models. Data stores are D1 users and models, D2 transactions, predictions and cases, D3 alerts.

### 4.5 UML Diagrams

**Use Case Diagram:** actors Analyst and Admin; subsystems Review (log in, add transaction, search ledger, flag/unflag, investigate case with SHAP, record decision, view alerts, browse DB tables) and Administration (compare models, select active model, adjust threshold, retrain, manage users). Admin generalizes Analyst, and Record Decision extends Investigate Case.

![Figure 4.5: Use Case Diagram](C:/Users/vandan/.gemini/antigravity-ide/brain/98eafd6a-f1ab-432d-b1e7-19ab8899a59d/use_case_diagram_1793024069255.jpg)

**Sequence Diagram:** add a transaction and predict. Invalid input returns an error; valid input is preprocessed (14 engineered features), scored, compared with the threshold (0.30), saved, and an alert is created when the score is at or above the threshold.

![Figure 4.3: Sequence Diagram – Add Transaction and Predict](C:/Users/vandan/.gemini/antigravity-ide/brain/98eafd6a-f1ab-432d-b1e7-19ab8899a59d/sequence_diagram_1793024056541.jpg)

**State machine:** a transaction starts as New, becomes Cleared (s < 0.30) or Flagged (s ≥ 0.30); flag/unflag moves it between the two; opening a case moves Flagged to In Review, which ends as Confirmed Fraud or Legit.

**Deployment view:** browser, Uvicorn with FastAPI (port 8080), MySQL server (port 3306) and saved model `.pkl` files on one local machine.

### 4.6 Database Design

The actual MySQL database `fraud_detection` has the following tables:

| Table | Columns | Keys and constraints |
|---|---|---|
| users | user_id, account_id, name, account_type, email, password_hash, created_at | PK user_id; account_id UNIQUE; email UNIQUE |
| transactions | transaction_id, user_id, sender_account_id, destination_account_id, step, transaction_type, amount, old_balance, new_balance, is_fraud | PK transaction_id; FK user_id; amount ≥ 0 |
| models | model_id, model_name, model_accuracy, model_precision, model_recall, model_f1_score, model_roc_auc, model_status, model_training_time | PK model_id |
| frauds (predictions) | prediction_id, transaction_id, model_id, Fraud_score, prediction, threshold, prediction_time | PK prediction_id; FK transaction_id, model_id; 0 ≤ Fraud_score ≤ 1 |
| alerts | alert_id, alert_type, severity, message, transaction_id, model_id, fraud_probability, feature_name, drift_score, drift_status, source_prediction_id, source_drift_report_id, dedupe_key, created_at | PK alert_id; FK transaction_id, model_id; dedupe_key UNIQUE |
| retraining_history | history_id, model_id, source_model_id, model_name, model_type, version, training_status, model_status, model_accuracy, model_precision, model_recall, model_f1_score, model_roc_auc, confusion_matrix (JSON), full_sample_confusion_matrix (JSON), full_sample_rows, training_rows, validation_rows, training_time_sec, threshold, artifact_path, retrained_at | PK history_id; FK model_id; model_id UNIQUE |
| drift_reports | report_id, model_id, feature_name, drift_score, drift_status, checked_at, report_time | PK report_id; FK model_id |

**Entity-Relationship Diagram:**

![Figure 4.4: Entity-Relationship Diagram](C:/Users/vandan/.gemini/antigravity-ide/brain/98eafd6a-f1ab-432d-b1e7-19ab8899a59d/er_diagram_1793023976973.jpg)

**Normalization.** Each fact is stored once, and prediction rows refer to their transaction and model by key, so the schema is in third normal form.

**Indexing.** Primary keys are indexed automatically. Secondary indexes exist on `alerts.alert_type`, `alerts.transaction_id`, `alerts.model_id`, `alerts.created_at`, `users.account_id`, and `users.email`.

**Representative records (illustrative values, not from the dataset):**

| txn_id | sender | dest | type | amount | status | score |
|---|---|---|---|---|---|---|
| 1 | ACC-A | ACC-B | TRANSFER | 1200.00 | cleared | 0.03 |
| 2 | ACC-C | ACC-D | CASH_OUT | 98000.00 | flagged | 0.91 |

### 4.7 Security and Error Handling Design

- **Authentication:** users log in with locally stored credentials; only password hashes are stored.
- **Authorization:** role checks in the backend. Admin-only actions are retraining, active model selection, cutoff change and user management.
- **Input validation:** every transaction is validated before preprocessing; invalid input returns an error message and nothing is stored.
- **Exception handling:** errors are caught by the API layer and returned as HTTP error responses with descriptive messages, so invalid input never crashes the system.
- **Protection of secrets:** database credentials are kept in the `.env` file (`DATABASE_URL` environment variable) outside the code and are not shown in the interface.


<div style="page-break-after: always; break-after: page;"></div>

## Chapter 5: Algorithm Design and Data Structures

### 5.1 Identification of Critical Operations

1. Preprocessing a transaction into a 14-feature vector (training and scoring).
2. Stratified 80:20 split and SMOTE on the training split.
3. Training the five classifiers.
4. Scoring one transaction and comparing it with the cutoff (0.30).
5. Computing TreeSHAP contributions for one transaction.
6. Searching and filtering the ledger and database tables.

### 5.2 Algorithm Design

**Model training and cutoff selection** (from `ml/train_multimodel.py`):

```python
def train_and_evaluate_all():
    df = load_stratified_dataset(DATA_PATH)  # All 8213 fraud + 80K sampled non-fraud
    X, y = engineer_features(df)             # 14 engineered features
    X_train, X_test, y_train, y_test = stratified_split(X, y, test_size=0.20)
    X_bal, y_bal = smote(X_train, y_train, sampling_strategy=0.5)
    threshold = 0.30
    for model in [RF, XGBoost, LightGBM, GradBoost, LogisticRegression]:
        model.fit(X_bal, y_bal)
        p = model.predict_proba(X_test)[:, 1]
        y_pred = (p >= threshold).astype(int)
        save(model, threshold, metrics(y_test, y_pred))
    sync_to_mysql(results)
```

SMOTE creates a synthetic minority sample x_new = x_i + λ(x_nn − x_i), where x_i is a minority sample, x_nn is one of its k nearest minority neighbours and λ is uniform in (0,1) [2].

**Real-time prediction** (from `routes/predict.py`):

```python
def predict_transaction(req):
    df = prepare_features(req)          # 14 engineered features
    score = active_model.predict_proba(df)[0][1]
    is_fraud = score >= 0.30
    reasons = explain_fraud_prediction(req, score, is_fraud)
    save_prediction(transaction_id, model_id, score, threshold)
    if is_fraud:
        create_fraud_alert(db, prediction, score)
    return {score, status, reasons, all_model_scores}
```

**Case investigation** (from `routes/transactions.py`):

```python
def explain_transaction(transaction_id):
    txn = load(transaction_id)
    features = preprocess(txn)
    shap_values = explain_tree_prediction(features)  # TreeSHAP
    top_features = rank_by_abs_shap(shap_values)
    return {base_value, shap_contributions, top_features}
```

### 5.3 Flowcharts

The training flow is shown below:

![Figure 5.1: Model Training Flowchart](C:/Users/vandan/.gemini/antigravity-ide/brain/98eafd6a-f1ab-432d-b1e7-19ab8899a59d/training_flowchart_1793024023779.jpg)

### 5.4 Data Structure Selection

- **Arrays and matrices:** the feature matrix X (n × 14) and the score vector.
- **Hash tables (dictionaries):** model metrics by model name (`metrics_comparison.json`), JSON responses, and encoding of transaction types to dummy variables.
- **Trees:** decision trees inside the ensemble models, walked by TreeSHAP.
- **B-tree indexes:** MySQL indexes for search by account, alert type and status.
- **Sorted list:** top-k features by absolute SHAP value, and the ranked list of high-risk transactions.

### 5.5 Algorithm Selection and Justification

| Task | Alternatives | Choice and reason |
|---|---|---|
| Imbalance handling | Class weights, undersampling, SMOTE | SMOTE on training data only (sampling_strategy=0.5); keeps all genuine samples and leaves test data realistic |
| Classifiers | One model vs. several | Five models, because algorithms behave differently on rare-event data; Logistic Regression is the baseline |
| Cutoff | Default 0.5, fixed 0.30 | Fixed 0.30 threshold, because 0.5 is rarely right for rare events; 0.30 provides better recall |
| Explanation | LIME, kernel SHAP, TreeSHAP | TreeSHAP for tree models: exact and fast [8]. Rule-based explanations used as supplement for all models |
| Metric | Accuracy, F1, ROC-AUC | F1 and ROC-AUC with precision and recall, since accuracy misleads on skewed data |

### 5.6 Time Complexity Analysis

Let n be training rows, d features (14), T trees, D maximum depth, L leaves per tree, m minority samples, k neighbours. These are approximate standard results.

| Operation | Time |
|---|---|
| Preprocessing one transaction | O(d) |
| Stratified split | O(n) |
| SMOTE (brute-force neighbours) | O(m² d) to find neighbours, O(s k d) to create s samples |
| Logistic Regression training | O(i n d) for i iterations (max_iter=1000) |
| Random Forest training | about O(T n log n d') with d' features tried per split (T=100, max_depth=16) |
| Boosted tree training | about O(T n d log n); histogram methods (LightGBM, XGBoost) reduce this (T=120, max_depth=6) |
| Scoring one transaction | O(d) for LR, O(T D) for tree models |
| TreeSHAP for one transaction | O(T L D²) [8] |
| Indexed search | O(log N) per lookup on N rows |

Training is offline and run by an Admin. The operations on the interactive path (scoring, SHAP, search) are cheap per transaction.

### 5.7 Space Complexity Analysis

The feature matrix needs O(n d) memory, and SMOTE enlarges the training matrix, so training memory grows with the number of synthetic samples. A tree ensemble stores O(T L) nodes. Scoring one transaction needs O(d) additional memory, and TreeSHAP needs about O(D²) extra working space per tree.

### 5.8 Optimization Opportunities

Cache the active model in memory at startup (implemented); compute SHAP only when a case is opened (implemented); add database indexes on the search columns (implemented on alert_type, transaction_id, created_at); use histogram-based boosting for faster training (implemented via HistGradientBoostingClassifier and LightGBM); and use approximate nearest-neighbour search or sampling if SMOTE becomes slow on larger data.


<div style="page-break-after: always; break-after: page;"></div>

## Chapter 6: Subject-Wise Engineering Concepts and APNI Leap Alignment

### 6.1 Software Engineering

- **Modularity:** preprocessing, model management, prediction, explanation, alerts, cases and the database explorer are separate modules with clear inputs and outputs (Section 4.2).
- **Requirement traceability:** functional requirements FR-01 to FR-13 map directly to test cases in Chapter 9.
- **State management:** a transaction's fraud status follows the state machine in Section 4.5; the active model and cutoff are stored values.
- **Exception handling:** invalid input is rejected with an error message before any state changes.
- **Version control:** the code is kept in a Git repository at `https://github.com/Vandangj/Fraud-Detection` (Section 7.8).

### 6.2 Computer Networks

The dashboard and the backend communicate as a client-server pair over HTTP using REST APIs, with JSON requests and responses. CSV and JSON exports of the database explorer are also served over HTTP. The main HTTP endpoints are:

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/predict/` | Score a transaction |
| GET | `/transactions/` | List transactions |
| POST | `/transactions/` | Add a transaction |
| GET | `/transactions/{id}/explanation` | TreeSHAP explanation |
| DELETE | `/transactions/{id}` | Delete a transaction |
| GET | `/alerts/` | List alerts |
| GET | `/models/` | List models |
| POST | `/retrain/` | Retrain a model |
| GET | `/retrain/history` | Retraining history |
| GET | `/users/` | List users |
| POST | `/users/` | Create user |
| GET | `/tables/` | List DB tables |
| GET | `/tables/{name}/rows` | Browse table rows |
| GET | `/frauds/` | List predictions |

### 6.3 Database Management Systems

The schema uses primary and foreign keys, uniqueness and range constraints, and third normal form (Section 4.6). MySQL is accessed through the SQLAlchemy ORM, and indexes support ledger search and filters. A transaction and its prediction are written in the same database session, and `db.commit()` wraps the step with implicit rollback on error.

### 6.4 Operating Systems

The backend runs as a Uvicorn server process that handles requests via async event loop. Model training is CPU-heavy and is run by an Admin as a separate offline run. The operating system schedules the processes; no custom Round Robin scheduling or thread synchronization is implemented by the project.

### 6.5 Data Structures

Arrays and matrices hold features, dictionaries hold metrics and encodings, trees form the ensemble models, B-tree indexes serve database search, and a sorted list ranks features by SHAP value (Section 5.4).

### 6.6 Design and Analysis of Algorithms

SMOTE, threshold-based classification, tree ensemble prediction and TreeSHAP are the critical algorithms. Their correctness conditions (SMOTE on training data only) and complexities are in Chapter 5. The cutoff (0.30) is fixed and not optimized per model on the test split, which avoids the risk of overfitting the threshold to the test data.

### 6.7 Cloud Computing

Not applicable. The system runs on a local machine and has not been deployed to a cloud platform. Cloud deployment is discussed as future work.

### 6.8 Mapping of Subjects to Project Implementation

| Subject | Concept applied | Project module | Evidence |
|---|---|---|---|
| Software Engineering | Modularity, traceability, exception handling, Git | All modules | Module table, test table, repository log |
| DBMS | Keys, constraints, normalization, indexing | Data access, DB explorer | Schema, queries |
| Data Structures | Matrices, hash tables, trees, sorted list | Preprocessor, models, explainer | Code and complexity table |
| Algorithms | SMOTE, threshold classification, TreeSHAP | Model manager, explainer | Pseudocode and complexity analysis |
| Computer Networks | Client-server REST over HTTP | Dashboard, backend | API endpoint list |
| Operating Systems | Process-based server; offline training | Backend, model manager | Resource measurements (Chapter 8) |


<div style="page-break-after: always; break-after: page;"></div>

## Chapter 7: Implementation and Module-Wise Coding

### 7.1 Development Environment

- **Python 3.11.9** with FastAPI for the backend
- **MySQL** with SQLAlchemy ORM (PyMySQL driver)
- **scikit-learn, imbalanced-learn, XGBoost, LightGBM and SHAP** for models and explanations
- **React 18 + Vite 5 + TailwindCSS 3** web dashboard calling REST APIs
- **Git** for version control
- **VS Code** editor
- **Windows 11** operating system (x64)

### 7.2 Overall Implementation Strategy

The work followed the order of the design: database schema and transaction management first; then preprocessing and the training pipeline for the five models; then the prediction endpoint, alerts and cases; then the TreeSHAP explainer; then the Model Health, DB Explorer and Admin pages. The same preprocessing code (`_prepare_df()` in `routes/predict.py` and `engineer_features()` in `ml/train_multimodel.py`) is used in training and scoring so both see the same 14 features.

### 7.3 Module-Wise Implementation

| Module | Processing logic | Dependencies | Code reference | Test evidence |
|---|---|---|---|---|
| Model manager | Preprocess, split, SMOTE on train, fit five models, save with threshold | Preprocessor, files, database | `ml/train_multimodel.py` | TC-07 |
| Predictor | Validate, preprocess, score, compare with cutoff, alert, save | Active model, database | `routes/predict.py` | TC-03, TC-05 |
| Case module | Load transaction and history, TreeSHAP, show top features, store decision | Explainer, database | `routes/transactions.py` | TC-06 |
| Preprocessor | Encode and prepare 14 features identically for training and scoring | scikit-learn, pandas | `ml/train_multimodel.py:engineer_features()`, `routes/predict.py:_prepare_df()` | TC-03 |
| Authentication | Hash check, roles | Database | `routes/users.py` | TC-01, TC-02 |
| Alerts | Create, filter, acknowledge | Database | `routes/alerts.py` | TC-09 |
| DB explorer | Table list, search, filter, page, export | Database | `routes/tables.py` | TC-11 |
| Admin and users | User CRUD, role change, active model, cutoff | Database, model manager | `routes/users.py`, `routes/models.py` | TC-08, TC-10 |
| Retraining | Retrain versioned models, record experiment | ML pipeline, database | `ml/retraining.py`, `routes/retrain.py` | TC-12 |

### 7.4 Front-End Implementation

The dashboard has nine React pages reachable from a navigation menu, with the active model shown in the header:

1. **Login** (`LoginPage.jsx`): credential entry with role-based routing
2. **Overview / Dashboard** (`DashboardPage.jsx`): totals, fraud rate, score chart with threshold, recent high-risk transactions, service status
3. **Transactions** (`TransactionsPage.jsx`): ledger, search, filters, add form, flag, delete, inspector panel
4. **Case Detail / SHAP** (`CaseDetailPage.jsx`): case view, TreeSHAP explanation, decision and notes
5. **Model Health** (`ModelHealthPage.jsx`): model comparison, confusion matrix, ROC and precision-recall curves, cutoff slider, retraining
6. **Drift Monitoring** (`DriftMonitoringPage.jsx`): feature drift tracking and visualization
7. **Alerts / Retrain** (`AlertsRetrainPage.jsx`): filters All, Critical, Warning and Resolved; acknowledge
8. **DB Tables Explorer** (`DatabaseTablesPage.jsx`): browse, search, filter, page, export CSV/JSON
9. **Admin and Users** (`AdminUsersPage.jsx`): user and role management

Forms validate input before sending it. Screenshots are in Chapter 10.

### 7.5 Back-End Implementation

FastAPI exposes REST endpoints for authentication, transactions, predictions, alerts, cases, models, database tables, retraining and users. Each endpoint validates input, calls the relevant module and returns JSON. The active model is loaded once at startup and reused for all predictions. Key endpoints include `POST /predict/`, `GET /transactions/{id}/explanation`, `POST /retrain/`, and `GET /tables/{name}/rows`.

### 7.6 Database Implementation

Tables follow Section 4.6 and are mapped to SQLAlchemy classes in `database_models.py`. The historical dataset is loaded into the transactions table via `load_dataset.py`, and ledger queries use filters and paging. Tables are auto-created via `Base.metadata.create_all(bind=engine)` at startup.

### 7.7 Communication and Concurrency Implementation

Communication is request-response over HTTP between the React dashboard (port 5173/5174) and the FastAPI backend (port 8080). CORS is configured to allow cross-origin requests from the Vite dev server. No custom concurrency control, locking or multi-threaded server code was written; Uvicorn's async event loop handles concurrent requests.

### 7.8 Git Repository Setup

- **Repository URL:** https://github.com/Vandangj/Fraud-Detection
- **Structure:** `main.py`, `database.py`, `database_models.py`, `crud.py`, `schemas.py` (root); `ml/` (training, prediction, retraining); `routes/` (API endpoints); `frontend/` (React application); `data/` (dataset); `models/` (saved .pkl files); `tests/` (test scripts)
- **Branching strategy:** `main` plus feature branches merged via pull requests
- **Commit convention:** type: short description (e.g. "fix: update vite proxy", "Add TreeSHAP transaction explanations")

| Member | Contribution |
|---|---|
| Vandan Jethwa | Backend APIs, ML training pipeline, database design, integration, report |
| Soham Gurav | Frontend React dashboard (all 9 pages), UI/UX design, TailwindCSS styling |
| Kushal Karkal | Frontend transaction actions, case detail fixes, testing, drift monitoring |

### 7.9 Integration of Modules

The backend is the integration point: the dashboard calls it, and it calls the preprocessor, the active model, the explainer and the database in the order shown in the sequence diagram (Section 4.5).

### 7.10 Implementation Challenges and Resolutions

| Challenge | Cause | Resolution |
|---|---|---|
| Misleading accuracy | Very few fraud rows (0.13%) | Judge on F1 and ROC-AUC; use fixed 0.30 cutoff instead of 0.50 |
| Leakage risk from SMOTE | Synthetic samples in test data inflate scores | SMOTE only on the training split |
| Train/serve mismatch | Different preprocessing at scoring time | Shared `engineer_features()` and `_prepare_df()` functions producing same 14 features |
| Explaining Logistic Regression | TreeSHAP works for trees only | Rule-based explanations used as supplement (balance drain, high-value, mule account checks) |
| Large dataset memory | 6.36M rows cannot fit in RAM at once | Stratified chunk loading: all fraud + 80K sampled non-fraud rows |
| Port conflicts | Multiple services on same ports | Configured FastAPI on 8080, Vite on 5173 |


<div style="page-break-after: always; break-after: page;"></div>

## Chapter 8: Scalability, Performance and Resource Management

This chapter is limited to what was measured. Every figure below comes from an actual run; nothing is projected.

### 8.1 Scalability Requirements

The system targets a single-machine deployment with a historical dataset of **6,362,620 transactions** and a few concurrent users (team and evaluators).

### 8.2 Workload and Load Model

The workload consists of individual prediction API calls (`POST /predict/`) for scoring single transactions interactively. The training pipeline processes a stratified sample of ~88,213 rows (all 8,213 fraud + 80,000 sampled non-fraud). Typical usage: 1 concurrent user during development and evaluation.

### 8.3 Resource Utilization

| Parameter | Training (five models) | Scoring one transaction | Idle |
|---|---|---|---|
| CPU utilization | ~90% (multi-core via n_jobs=-1) | < 5% | < 1% |
| Memory | ~500 MB (dataset + SMOTE) | < 100 MB (loaded model) | ~80 MB |
| Storage (database, model files) | ~470 MB dataset + ~4.3 MB model files | — | — |

### 8.4 Concurrent Processing

The backend serves requests concurrently through Uvicorn's async event loop. No custom thread management or locking was written (Section 7.7).

### 8.5 Scheduling and Synchronization Analysis

Not applicable. Round Robin scheduling and synchronization mechanisms are not implemented in this project.

### 8.6 Performance Measurement

- **Test machine:** Windows 11, x64 laptop, Python 3.11.9
- **Dataset size:** 6,362,620 rows (training sample: ~88K rows)
- **Measurement tool:** `time.time()` timestamps in training script; API response times in browser DevTools
- **Repetitions:** 1 full training run (results saved to `metrics_comparison.json`)

### 8.7 Performance Results

| Model | Training time (s) | Inference latency (ms/query) |
|---|---|---|
| RandomForest (SMOTE) | 1.98 | 0.003 |
| XGBoost | 1.13 | 0.001 |
| LightGBM | 0.64 | 0.002 |
| Gradient Boosting | 3.38 | 0.003 |
| Logistic Regression | 2.01 | < 0.001 |

All models scored well under the 2-second target for a single prediction. End-to-end API response (including DB write) was under 500 ms.

### 8.8 Bottleneck Identification

The primary bottleneck is SMOTE computation during retraining, which scales with the number of minority samples. TreeSHAP computation on case open adds a small delay but is only triggered on demand. Ledger searches are indexed and fast.

### 8.9 Optimization and Improvement

- Active model cached in memory at startup (avoids disk I/O per prediction).
- TreeSHAP computed only on demand when a case is opened (not for every prediction).
- Database indexes on `alerts.alert_type`, `alerts.transaction_id`, and `alerts.created_at` speed up alert queries.
- Histogram-based boosting (HistGradientBoostingClassifier, LightGBM) used for faster training.
- Stratified chunk loading reduces memory for the 6.36M-row dataset.

### 8.10 Cloud Deployment and Resource Utilization

Not applicable; the system is not deployed on cloud infrastructure.

### 8.11 Scalability Limitations

The maximum tested workload is 1 concurrent user with ~88K training rows and individual prediction calls. Anything beyond this is untested and is not claimed.


<div style="page-break-after: always; break-after: page;"></div>

## Chapter 9: Testing and Validation

### 9.1 Testing Strategy

Testing proceeds from unit tests of individual functions, through integration tests of the dashboard, backend, database and models, to functional tests against FR-01 to FR-13, then non-functional, boundary and invalid-input tests.

### 9.2 Unit Testing

Functions tested: preprocessing (`engineer_features`, `_prepare_df`), validation (input field checks), threshold comparison (score ≥ 0.30), role check, password hashing. The retraining module has dedicated unit tests in `tests/test_retraining.py`.

### 9.3 Integration Testing

Interactions verified: dashboard to API (React → FastAPI), API to MySQL (SQLAlchemy ORM), API to preprocessor and active model (`routes/predict.py`), API to TreeSHAP (`routes/transactions.py:explain_transaction`), alert creation after a flagged prediction (`crud.create_fraud_alert`).

### 9.4 Functional Testing

Each functional requirement is tested against its acceptance criterion in Section 3.4 (see Section 9.8).

### 9.5 Non-Functional Testing

Response time of scoring (< 500 ms end-to-end) and ledger search (< 1 s), usability of the seven pages, reliability under invalid input, and role-based access (an Analyst must not reach Admin pages).

### 9.6 Boundary and Invalid-Input Testing

Empty fields, negative amounts, non-numeric values, unknown transaction type, missing balances, duplicate usernames, invalid role, and cutoff slider at 0 and 1. Expected result: an error message, no crash, nothing stored.

### 9.7 Concurrency and Stress Testing

No formal multi-user stress test was performed. This is listed under Section 9.11 as an untested scenario.

### 9.8 Test Case Specification

| TC ID | Req ID | Scenario | Input / precondition | Expected result | Actual result | Status |
|---|---|---|---|---|---|---|
| TC-01 | FR-01 | Valid login | Correct username and password | Session starts, dashboard loads | Session started, redirected to Overview | Pass |
| TC-02 | FR-01 | Invalid login | Wrong password | Login refused with error message | Error displayed: "Invalid credentials" | Pass |
| TC-03 | FR-03, FR-05 | Add valid transaction and predict | All fields valid (TRANSFER, amount=50000, step=10) | Transaction appears in ledger with fraud score | Transaction saved, score returned (e.g. 0.91), alert created | Pass |
| TC-04 | FR-04 | Add invalid transaction | Negative amount (-500) | Error shown, nothing stored | HTTP 422 error returned, no DB record | Pass |
| TC-05 | FR-05, FR-06 | Score at threshold triggers alert | Score = 0.91 (>= 0.30) | Flagged, alert created | Transaction flagged, alert with severity "critical" created | Pass |
| TC-06 | FR-07 | Open case with TreeSHAP | Flagged transaction | TreeSHAP feature contributions listed | SHAP values returned: base_value, feature contributions, top features ranked | Pass |
| TC-07 | FR-09 | Five models trained and compared | Run `train_multimodel.py` | Five models listed with 7 metrics each | All 5 models saved to `.pkl`, metrics in `metrics_comparison.json`, synced to MySQL | Pass |
| TC-08 | FR-02 | Analyst on Admin page | Analyst session | Access denied | Admin-only features hidden for Analyst role | Pass |
| TC-09 | FR-06 | Filter alerts by severity | Select "Critical" filter | Only critical alerts shown | Filter returns only critical-severity alerts | Pass |
| TC-10 | FR-10 | Change active model | Select LightGBM as active | Next prediction uses LightGBM | Model status updated, subsequent prediction uses `lgb-fast-v1` | Pass |
| TC-11 | FR-13 | Export CSV | Open DB table, click export CSV | File downloads with displayed data | CSV file generated and downloaded with correct table contents | Pass |
| TC-12 | FR-11 | Retrain model | POST `/retrain/` with source model | New versioned model with metrics and experiment record | New model version created (e.g. `rf-balanced-v2`), metrics saved, retraining_history updated | Pass |
| TC-13 | FR-12 | Overview dashboard loads | Navigate to Overview page | Total transactions, flagged count, fraud rate, score distribution chart with threshold line shown | All KPI cards populated, chart rendered with 0.30 threshold line | Pass |

### 9.9 Defect Identification and Resolution

| Defect | Found in | Fix | Retest result |
|---|---|---|---|
| Port conflict between FastAPI and other services | Integration testing | Changed FastAPI to port 8080, updated Vite proxy | Resolved |
| SMOTE leaking into test split | Code review | Moved SMOTE after train_test_split | Verified: test metrics realistic |
| Missing one-hot columns for rare transaction types | Edge case testing | Added fallback: `if col not in df.columns: df[col] = 0` | All types handled |
| Retraining history missing split counts | Retraining testing | Added ALTER TABLE migration in `main.py` startup | Columns backfilled |

### 9.10 Validation Against KPIs

| KPI | Target | Measured | Met? |
|---|---|---|---|
| Response time | ≤ 2 s | < 500 ms (prediction API) | Met |
| Functional correctness | 100% | 13/13 test cases passed | Met |
| Reliability | 100% | All invalid inputs handled without crash | Met |
| Model quality | F1 above LR baseline (0.7983) | RF F1 = 0.9970, XGB F1 = 0.9957 | Met |
| Explanation coverage | 100% (tree models) | TreeSHAP returns for all flagged transactions | Met |
| Resource use | Within laptop capacity | Training < 10 s total, < 500 MB RAM | Met |

### 9.11 Limitations and Untested Scenarios

Not tested: real payment data, large workloads beyond the project dataset (6.36M rows), cloud deployment, multi-user concurrency beyond 1 user, and automated model retraining triggers.


<div style="page-break-after: always; break-after: page;"></div>

## Chapter 10: Results, Demonstration and Discussion

### 10.1 Implemented Features

The dashboard pages are built and running: Login, Overview, Transactions, Case Detail/SHAP, Model Health, Drift Monitoring, Alerts/Retrain, DB Tables Explorer, and Admin/Users, backed by FastAPI and MySQL, with five trained models, TreeSHAP explanations, role-based access and CSV/JSON export.

### 10.2 Screenshots and Demonstration Evidence

Screenshots from the running application are available in the frontend directory under numbered folders:
1. Login/Access Portal
2. Overview Dashboard
3. Transactions Management
4. Case Detail / SHAP Explainability
5. Model Health / Performance
6. Drift Monitoring
7. Alerts / Retrain Resolution
8. Admin / User Management

### 10.3 Functional Results

All 13 test cases from Section 9.8 passed. Every functional requirement (authentication FR-01, RBAC FR-02, ingestion FR-03, validation FR-04, scoring FR-05, alerts FR-06, TreeSHAP FR-07, case review FR-08, model benchmarking FR-09, active model management FR-10, retraining FR-11, analytics dashboard FR-12, and data explorer FR-13) has at least one passing test case.

### 10.4 Performance Results

Measured values from `metrics_comparison.json` (generated by `ml/train_multimodel.py`):

| Model | Accuracy | Precision | Recall | F1 | ROC-AUC | Inference latency (ms) | Training time (s) |
|---|---|---|---|---|---|---|---|
| **RandomForest (SMOTE)** | **0.9994** | **0.9976** | **0.9963** | **0.9970** | **0.9984** | 0.003 | 1.98 |
| XGBoost | 0.9992 | 0.9951 | 0.9963 | 0.9957 | 0.9994 | 0.001 | 1.13 |
| LightGBM | 0.9994 | 0.9982 | 0.9957 | 0.9970 | 0.9994 | 0.002 | **0.64** |
| Gradient Boosting | 0.9993 | 0.9963 | 0.9963 | 0.9963 | 0.9990 | 0.003 | 3.38 |
| Logistic Regression (baseline) | 0.9556 | 0.6915 | 0.9440 | 0.7983 | 0.9886 | < 0.001 | 2.01 |

**Confusion matrices (threshold = 0.30):**

| Model | TN | FP | FN | TP |
|---|---|---|---|---|
| RandomForest | 15,996 | 4 | 6 | 1,637 |
| XGBoost | 15,992 | 8 | 6 | 1,637 |
| LightGBM | 15,997 | 3 | 7 | 1,636 |
| Gradient Boosting | 15,994 | 6 | 6 | 1,637 |
| Logistic Regression | 15,308 | 692 | 92 | 1,551 |

### 10.5 Comparison with Existing Systems

Compared with the approaches in Table 2.3, the system adds per-transaction explanations, a multi-model comparison and an analyst workflow. The comparison is on features and workflow, not on detection accuracy against commercial products, which was not measured.

### 10.6 Achievement of Objectives

| Objective | Evidence |
|---|---|
| O1 Transaction management | FR-03, FR-04 tests (TC-03, TC-04); Transactions page |
| O2 Scoring | FR-05 tests (TC-03); predict endpoint |
| O3 Five-model comparison | FR-09 tests (TC-07); Model Health page; Table 10.4 metrics |
| O4 80:20 split, SMOTE on train | `train_multimodel.py`; Section 5.2 |
| O5 Flag and alert | FR-05, FR-06 tests (TC-05, TC-09); Alerts page |
| O6 TreeSHAP and decisions | FR-07, FR-08 tests (TC-06); Case Detail page |
| O7 Roles and hashed passwords | FR-01, FR-02 tests (TC-01, TC-02, TC-08); Admin and Users page |
| O8 Database explorer | FR-13 tests (TC-11); DB Tables Explorer page |

### 10.7 Discussion of Findings

All four tree-based models achieved F1 > 0.99, significantly outperforming the Logistic Regression baseline (F1 = 0.7983). RandomForest and LightGBM tied for the highest F1-score (0.9970), but LightGBM was the fastest to train (0.64 s vs. 1.98 s). XGBoost had the highest ROC-AUC (0.9994) and lowest inference latency (0.001 ms). The Logistic Regression baseline produced 692 false positives compared to only 3–8 for the tree models, confirming that accuracy alone (0.9556 for LR) is misleading when the class imbalance is extreme (0.13% fraud).

The fixed threshold of 0.30 proved effective for all tree models, yielding very low false positive rates (< 0.05%) while maintaining recall above 99.5%.

### 10.8 Practical Applicability

The system can serve as a review desk tool: transactions are scored, high-risk ones are alerted, and analysts read explanations and record decisions. It is a student-scale prototype on historical data and is not a production banking system.


<div style="page-break-after: always; break-after: page;"></div>

## Chapter 11: Conclusion and Future Scope

### 11.1 Conclusion

The project built a web-based system that scores financial transactions with five compared machine learning models, flags them at a 0.30 threshold, raises alerts, explains each flag with TreeSHAP and rule-based reasoning, and records analyst decisions, with role-based access and a database explorer. All four tree-based models achieved F1 > 0.99, significantly outperforming the Logistic Regression baseline.

### 11.2 Achievement of Objectives

Objectives O1 to O8 are mapped to evidence in Section 10.6. All objectives are achieved with supporting test evidence and functional demonstrations.

### 11.3 Major Engineering Contributions

- A single workflow from scoring to analyst decision
- A leakage-safe training protocol (SMOTE on train only)
- A modular design in which models can be swapped
- A Model Health page for comparison, cutoff tuning and retraining
- Stratified chunk loading for handling a 6.36M-row dataset on a standard laptop

### 11.4 Current Limitations

- Historical data only; single local machine
- No real payment or bank integration
- TreeSHAP applies to tree models only, so Logistic Regression uses rule-based explanations instead
- Fixed threshold (0.30) rather than per-model optimized cutoff
- Concurrency and large-scale behaviour untested

### 11.5 Future Enhancements

- Per-model optimized cutoff (best-F1 threshold selection)
- Separate validation split for cutoff selection
- Streaming ingestion from payment networks
- Cloud deployment (Docker + AWS/GCP)
- Automated periodic retraining triggers
- More models (neural networks) and cost-sensitive thresholds
- Stronger logging and audit trails

### 11.6 Lessons Learned

- Accuracy is misleading on rare-event data (0.13% fraud rate)
- Test data must be kept free of synthetic samples (SMOTE leakage)
- Sharing one preprocessing step between training and scoring avoids feature mismatches
- Reports must claim only what has evidence
- Stratified sampling is essential when loading large imbalanced datasets


<div style="page-break-after: always; break-after: page;"></div>

## References

[1] A. Dal Pozzolo, O. Caelen, R. A. Johnson and G. Bontempi, "Calibrating probability with undersampling for unbalanced classification," in *Proc. IEEE SSCI*, 2015.

[2] N. V. Chawla, K. W. Bowyer, L. O. Hall and W. P. Kegelmeyer, "SMOTE: Synthetic Minority Over-sampling Technique," *Journal of Artificial Intelligence Research*, vol. 16, pp. 321–357, 2002.

[3] L. Breiman, "Random Forests," *Machine Learning*, vol. 45, pp. 5–32, 2001.

[4] J. H. Friedman, "Greedy function approximation: a gradient boosting machine," *Annals of Statistics*, vol. 29, no. 5, pp. 1189–1232, 2001.

[5] T. Chen and C. Guestrin, "XGBoost: A scalable tree boosting system," in *Proc. ACM SIGKDD*, 2016.

[6] G. Ke et al., "LightGBM: A highly efficient gradient boosting decision tree," in *Advances in Neural Information Processing Systems*, 2017.

[7] S. M. Lundberg and S.-I. Lee, "A unified approach to interpreting model predictions," in *Advances in Neural Information Processing Systems*, 2017.

[8] S. M. Lundberg et al., "From local explanations to global understanding with explainable AI for trees," *Nature Machine Intelligence*, vol. 2, pp. 56–67, 2020.

[9] T. Saito and M. Rehmsmeier, "The precision-recall plot is more informative than the ROC plot when evaluating binary classifiers on imbalanced datasets," *PLOS ONE*, vol. 10, no. 3, 2015.

[10] F. Pedregosa et al., "Scikit-learn: Machine learning in Python," *Journal of Machine Learning Research*, vol. 12, pp. 2825–2830, 2011.

[11] IEEE Std 830-1998, *Recommended Practice for Software Requirements Specifications*.

---

*Financial Fraud Detection System — Mini Project Report*
