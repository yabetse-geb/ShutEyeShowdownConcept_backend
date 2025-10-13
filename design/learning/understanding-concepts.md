[@concept-design-overview](../background/concept-design-overview.md)

# question: How to ensure concepts are independent?
# response:

The concept design background explicitly states one of the key motivations: "Completely independent of one another in terms of dependencies and state."

To ensure your concepts are independent, you must rigorously adhere to this principle by focusing on isolation and clear boundaries. Here's how:

1.  **Strict State Isolation:**
    *   **Rule:** A concept's `state` must be entirely self-contained. No two concepts should ever share mutable state (e.g., the same database table, the same in-memory object, the same global variable).
    *   **How:** Each concept is the sole owner and manager of its specific information. If Concept A needs information that Concept B owns, Concept B must *explicitly provide it* (e.g., as an event payload, or a return value from an action), rather than Concept A directly accessing Concept B's internal state.
    *   **Relates to Spec:** The `state` element in your specification should define only the information essential for *that specific concept's* purpose, and nothing more.

2.  **Single, Well-Defined Purpose (Strong Cohesion):**
    *   **Rule:** Each concept must have a *single purpose* that is clearly defined and user-relevant. Avoid concepts that try to do too many things.
    *   **How:** A focused `purpose` naturally limits the scope of a concept, preventing it from needing to depend on, or manage information related to, other unrelated concerns. If you find a concept's purpose expanding or overlapping significantly with another, it's a sign that it's not truly independent, or that your decomposition needs refinement.
    *   **Relates to Spec:** The `purpose` statement is critical here. It acts as a contract for what the concept does and, implicitly, what it *doesn't* do.

3.  **Generic Parameters, Not Specific Types (Loose Coupling):**
    *   **Rule:** Concepts must work off generic parameters and avoid knowing about specific types from other parts of the system or other concepts.
    *   **How:** Instead of Concept A operating on a `UserAccount` object (which might be defined by a `User` concept), it operates on an `AccountIdentifier` or an `Amount`. The specific binding of these generics to concrete types happens *outside* the concept, typically in an orchestration layer. This prevents direct type-level dependencies between concepts.
    *   **Relates to Spec:** This informs how you write your `state` and `actions`. Instead of "a UserProfile," think "an IdentityReference" or "a ProfileSnapshot."

4.  **Interaction via Events or Explicit API Contracts (No Direct Calls/Shared Logic):**
    *   **Rule:** Concepts do not directly call each other's internal functions or access each other's data. They interact through well-defined `actions` (as explicit commands/requests) or by publishing/subscribing to events.
    *   **How:**
        *   **Actions:** A concept exposes its `actions` as its public API, defined by `pre/postconditions`. These conditions should only refer to the *concept's own state* and the *parameters passed into the action*. They should not require other concepts to be in a certain state.
        *   **Events:** When a concept changes its state or completes a significant operation, it can emit an event. Other concepts that are interested can subscribe to these events. The event payload should only contain the necessary *information* for subscribers, not a reference to the publishing concept itself.
    *   **Relates to Spec:** The `actions` define the boundary and interaction points. The `pre/postconditions` enforce what's required and what's effected *within that concept's domain only*.

5.  **Principle-Driven Boundaries:**
    *   **Rule:** Use the `principle` (motivating scenario) to validate the concept's boundaries.
    *   **How:** Does the `principle` for Concept A require it to understand or modify the `state` of Concept B? If so, the concepts are likely not independent, or their boundaries are drawn incorrectly. A principle for a concept should illustrate how *that specific concept* achieves *its own purpose* in isolation, or how it acts as a self-contained unit within a larger system.

By consistently applying these guidelines, you'll design concepts that are truly independent, leading to more modular, testable, and maintainable software. Each concept becomes a "black box" that fulfills its purpose without needing to know the internal workings or state of any other concept.