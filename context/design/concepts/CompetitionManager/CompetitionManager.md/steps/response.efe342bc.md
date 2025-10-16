---
timestamp: 'Wed Oct 15 2025 02:26:35 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251015_022635.c4f4cad9.md]]'
content_id: efe342bcb4073e49b75ae242d2491e57a5b9fd8a5b39592ff494873b3b05825b
---

# response:

Ensuring your concepts are independent is a cornerstone of the concept design methodology, driven by three core principles outlined in the background material:

1. **Complete independence in terms of dependencies and state.**
2. **Working off generic parameters, not specific types.**
3. **Strong grounding in a user-relevant purpose, not just a software structure.**

Here's how to ensure your concepts adhere to these principles and maintain independence:

### 1. Separate State and Dependencies

* **Own Your State:** Each concept's `state` definition should exclusively describe the information *it* manages. It should not contain data that is primarily owned or managed by another concept. The `UserProfile` and `UserAuthentication` example illustrates this perfectly: both refer to `User` but manage different aspects (bio/thumbnail vs. username/password).
* **No Direct State Access Across Concepts:** Concepts should not directly read or write the internal state variables of other concepts. All interactions should be mediated through well-defined actions or queries (for published state).
* **Interaction via Actions/Events, Not Direct Calls:** Concepts interact by triggering their own actions, which might implicitly cause other concepts to react if they are "synced" to those events. A concept's action should modify *only* its own state and return results specific to its own purpose. It should not make direct method calls on instances of other concepts to modify *their* state. This avoids tight coupling.
* **No Shared Internal State Objects:** Avoid passing mutable internal state objects directly between concepts. If a concept needs to refer to an entity managed by another concept, it should use a generic identifier.

### 2. Work Off Generic Parameters

* **Use Type Parameters for External Entities:** When a concept needs to refer to entities that are managed by other concepts (e.g., `User`, `Target`, `Item`), declare them as generic type parameters (e.g., `Comment [User, Target]`, `Labeling [Item]`).
* **Treat Generic Parameters as Opaque Identifiers:** The concept should treat these generic types as abstract identifiers. It can store them, compare them for equality, and pass them as arguments or results, but it *cannot* assume they have specific properties (like `username`, `bio`, `size`, etc.) or call specific methods on them. This prevents the concept from becoming coupled to the internal structure or behavior of those external types.
  * **Example:** The `CompetitionManager [User]` concept refers to `User` in its `participants` and `Scores`. It does not define what a `User` *is* (e.g., if it has an email, a password, a profile picture). It only knows `User` as a distinct identifier. Another concept (like `UserAuthentication` or `UserProfile`) would be responsible for defining those properties.
* **Avoid Casting or Type-Specific Logic:** If you find yourself needing to cast a generic type parameter to a specific type, or implementing logic that relies on properties not part of the generic contract, it's a strong indicator that your concept is violating independence.

### 3. Ground in a User-Relevant, Focused Purpose

* **Single, Clear Purpose:** A concept must have a single, well-defined, user-relevant purpose. This is the most fundamental guideline for concept design. If a concept's purpose is too broad or ambiguous, it will naturally tend to absorb responsibilities that belong to other concepts, leading to entanglement.
  * **Ask:** "What is the *single* problem this concept solves for the user?"
* **Focused Scope:** The purpose should dictate a narrow, focused scope for the concept's state and actions. If a concept starts to accumulate state or actions that don't directly serve its primary purpose, it might be taking on responsibilities that belong to another concept.
  * **Example:** The `Labeling` concept's purpose is "to associate labels with items and then retrieve the items that match a given label." Its state and actions are strictly limited to managing these associations and label names. It doesn't concern itself with the content of the `Item` or other aspects, ensuring its independence from an `EmailMessage` or `Document` concept.
* **Differentiating Principle:** The `principle` should clearly differentiate the concept's functionality from simpler or related concepts. If the principle includes aspects that don't belong (or omits aspects that are crucial for differentiation), it suggests the concept's boundaries might be ill-defined, potentially leading to overlap or dependencies.

By consistently applying these guidelines, you can design concepts that are truly independent, reusable, and easier to understand and evolve.
