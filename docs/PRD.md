# PRD: Beauty Clinic Management System

## 1. Overview
A management system for beauty clinic managers and therapists. It centralizes customers, package types, treatment series, orders, payments, appointments, therapists, timer-based treatments, photos, and system settings.

## 2. Goals
- Provide a complete customer view in one screen.
- Track quantity-based and timer-based treatment series accurately.
- Schedule appointments based on therapist availability and treatment type.
- Track orders, payments, and outstanding balances.
- Allow managers to control package types and global settings.

## 3. Target User
The primary users are the clinic manager and therapists. The manager can configure and edit all system information. Therapists handle daily customer activity and may create orders and payments but cannot edit them after saving.

## 4. User Stories

### US-001: Manage customer profiles
**Story:** As a manager or therapist, I want to create, search, and view customer profiles so that I can access customer information and actions quickly.
**Acceptance Criteria:**
- [ ] A customer can be created with full name, phone number, and email address.
- [ ] Full name, phone number, and email address are required.
- [ ] Missing required values prevent saving and display an error beside the relevant field.
- [ ] Users can search for an existing customer and open the customer profile.
- [ ] The profile displays the previous appointment, next appointment, outstanding balance, and actions for order, payment, appointment, and note creation.

### US-002: Create an order
**Story:** As a manager or therapist, I want to create an order with one or more packages so that the purchase and balance can be tracked.
**Acceptance Criteria:**
- [ ] Managers and therapists can create an order from the customer profile.
- [ ] One or more predefined package types can be added.
- [ ] The order displays date, original price, discounted price, discount percentage, amount paid, and remaining balance.
- [ ] A new order receives the global maximum payment count.
- [ ] A manager can override the maximum payment count for a specific order.

### US-003: Record order payments
**Story:** As a manager or therapist, I want to record multiple payments for an order so that the paid amount and remaining balance stay current.
**Acceptance Criteria:**
- [ ] Managers and therapists can add a payment from the customer profile or order details.
- [ ] A payment includes order, amount, payment method, and date.
- [ ] Payments can be added until the order reaches its maximum payment count.
- [ ] Each payment updates the total paid amount and remaining balance.
- [ ] Therapists cannot edit payments after saving.

### US-004: Track active treatment series
**Story:** As a manager or therapist, I want to view active treatment series so that I can see how much of each series has been used.
**Acceptance Criteria:**
- [ ] The customer profile includes an Active Series tab.
- [ ] Quantity-based series display completed treatments out of total treatments.
- [ ] Timer-based series display total used time out of total available time.
- [ ] Completed treatments for timer-based series are calculated from cumulative used time.
- [ ] A manager can manually edit total treatments, completed treatments, total time, and used time.

### US-005: Run a timer-based treatment
**Story:** As a therapist, I want to run a treatment timer so that treatment usage is calculated from actual cumulative time.
**Acceptance Criteria:**
- [ ] The timer can be started, paused, resumed, and reset.
- [ ] The measured duration is displayed when the treatment ends.
- [ ] The duration is added to the package’s cumulative used time.
- [ ] Completed treatments equal cumulative used time divided by minutes per treatment.
- [ ] The result is rounded down before updating the completed treatment count.

### US-006: View treatment history and photos
**Story:** As a manager or therapist, I want to record treatments and photos so that treatment history and progress can be reviewed.
**Acceptance Criteria:**
- [ ] The customer profile includes a Treatment History tab.
- [ ] Each record displays date, treatment type, and therapist.
- [ ] Timer-based records also display treatment duration.
- [ ] One or more photos can be added to a treatment.
- [ ] Treatment photos appear in the customer gallery.

### US-007: Schedule an appointment
**Story:** As a manager or therapist, I want to schedule appointments based on availability so that conflicts are prevented.
**Acceptance Criteria:**
- [ ] An appointment includes customer, treatment type, date, time, and therapist.
- [ ] Selecting a date shows therapists who are available and qualified for the treatment.
- [ ] Selecting a therapist shows the next five available dates.
- [ ] Selecting a therapist and date shows available time slots.
- [ ] An appointment cannot be saved in an unavailable slot.

### US-008: Manage therapists
**Story:** As a manager, I want to configure therapist availability and treatment capabilities so that appointment availability is accurate.
**Acceptance Criteria:**
- [ ] Only managers can access therapist management.
- [ ] A manager can define working days and start and end times.
- [ ] A manager can define unavailable dates.
- [ ] A manager can assign supported treatment types.
- [ ] Availability reflects working hours, exceptions, existing appointments, and treatment type.

### US-009: Manage package types
**Story:** As a manager, I want to manage package types so that orders and treatment tracking use consistent definitions.
**Acceptance Criteria:**
- [ ] Only managers can create and edit package types.
- [ ] A package type includes name, treatment type, series status, and treatment count.
- [ ] A series package can be marked as timer-based and assigned minutes per treatment.
- [ ] A timer-based package cannot be saved unless it is also marked as a series.
- [ ] Minutes per treatment are required and must be greater than zero for timer-based packages.

### US-010: Manage global settings and edit permissions
**Story:** As a manager, I want to manage global settings and edit all operational information so that clinic settings remain current.
**Acceptance Criteria:**
- [ ] Only managers can access global settings.
- [ ] A manager can define the default maximum payment count for new orders.
- [ ] The maximum payment count must be a whole number greater than zero.
- [ ] A manager can edit customers, orders, payments, appointments, treatments, series, notes, therapists, and package types.
- [ ] Previous values are not retained after edits.

## 5. Functional Requirements
- FR-1: The customer profile must include Active Series, Treatment History, Orders, Payments, and Notes tabs.
- FR-2: Ending a timer-based treatment must add its duration to the package’s cumulative used time.
- FR-3: Completed treatments must equal cumulative used time divided by minutes per treatment, rounded down.
- FR-4: Recording a payment must update the order’s total paid amount and remaining balance.
- FR-5: New orders must use the global maximum payment count unless a manager overrides it.
- FR-6: Appointment availability must consider working hours, unavailable dates, existing appointments, and treatment type.
- FR-7: A timer-based package type must also be marked as a series.
- FR-8: Managers must be able to edit all system information, while therapists may only create orders and payments.

## 6. Out of Scope (Non-Goals)
- Customer self-service appointment booking.
- Automated appointment reminders.
- Online payment collection.
- Inventory and product management.
- Marketing campaigns and messaging.
- Business analytics and management reports.
- Edit history and previous-value tracking.

## 7. Success Criteria
- A customer cannot be created without full name, phone number, and email address.
- New orders receive the global maximum payment count.
- Managers can override the payment count for an individual order.
- Timer-based packages cannot be saved unless they are series packages.
- Timer-based treatment usage is calculated from cumulative time and rounded down.

## 8. Open Questions
None at this stage.

## 9. Data Hints (Optional)
- Customer: full name, phone number, email address.
- Package type: name, treatment type, series status, treatment count, timer status, minutes per treatment.
- Global settings: default maximum payment count.
- Order: date, packages, original price, discounted price, discount percentage, maximum payment count, amount paid, remaining balance.
- Payment: date, order, amount, payment method.
- Treatment: date, treatment type, therapist, duration, photos.
- Note: date, therapist, treatment type, content.
- Therapist: working days, working hours, unavailable dates, supported treatment types.
- Timer-based series: total time, cumulative used time, completed treatment count.