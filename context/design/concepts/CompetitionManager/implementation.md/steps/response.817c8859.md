---
timestamp: 'Mon Oct 13 2025 14:20:17 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251013_142017.00a48915.md]]'
content_id: 817c885925b4e45c813cc8a60c276c08ff658930360f4c4f69af339870f19f34
---

# response:

Here's how to ensure your concepts are independent, based on the provided "Concept Design Background" and "Structure of a concept specification" documentation:

### How to Make Sure Your Concepts Are Independent

The documentation explicitly states that concepts are "Completely independent of one another in terms of dependencies and state" and highlights key characteristics that contribute to this independence. To ensure your concepts are independent, follow these principles:

1. **Encapsulate a Single, User-Relevant Purpose:**
   * Each concept must have a very specific, well-defined purpose that addresses a user need. This prevents a concept from becoming overly broad and trying to manage functionality that belongs elsewhere.
   * *Example:* The `Labeling` concept's purpose is *only* to associate labels with items and retrieve items by label. It doesn't handle the content of the items themselves or other messaging functions.
   * *Check:* If a concept's purpose statement sounds too generic or overlaps significantly with another concept's purpose, it might indicate a lack of clear separation.

2. **Strictly Separate State and Concerns:**
   * A concept manages its *own* state, which represents all the necessary information for *its* specific behavioral concern. It should not directly access or modify the internal state of another concept.
   * *Example:* `UserAuthentication` might store `username` and `password` for `Users`, while `UserProfile` stores `bio` and `thumbnail` for the *same* generic `Users`. These are distinct views or partitions of data related to a `User` entity, managed independently by separate concepts.
   * *Check:* If your concept's state includes details that are primarily managed or owned by another concept, or if an action in your concept needs to directly alter another concept's internal state, your concepts are likely not independent.

3. **Work Off Generic Type Parameters (Polymorphism):**
   * Concepts should be defined using generic type parameters (e.g., `User`, `Item`, `Target`). They should treat these parameters as opaque identifiers or references, without knowing their concrete types or internal properties.
   * *Example:* The `Comment` concept takes `User` and `Target`. It doesn't know if `User` comes from `UserAuthentication` or `UserProfiles`, nor does it know if `Target` is a `Post`, `Image`, or `Document`. It only knows how to associate text with these generic IDs.
   * *Check:* If your concept's actions or state implicitly or explicitly rely on specific properties or methods of a "typed" object that is intended to be managed by *another* concept, you are creating a direct dependency.

4. **No Direct Code-Level Dependencies (Imports/References):**
   * This is a crucial implementation rule: "No import statements can reference another concept in any way, including type declarations."
   * Concepts should communicate indirectly, often by referencing shared generic IDs or by acting as a response to events (though the event mechanism isn't fully detailed in this text, it's implied by the "interleaved sequence of events" in "Concept actions").
   * *Check:* During implementation, strictly enforce that a concept's TypeScript class does not `import` or directly reference types or instances of other concept classes.

5. **Behavioral Completeness (for its purpose):**
   * Each concept must embody *all* the functionality (actions and queries) required to fulfill its specific purpose. It should not rely on other concepts to complete its core operations.
   * *Example:* The `Labeling` concept provides `createLabel`, `addLabel`, `deleteLabel`, enabling it to fully manage the labeling process for any `Item` without delegating core labeling logic to an `EmailMessage` class.
   * *Check:* If a user workflow related to a concept's purpose requires invoking methods from multiple concepts in a tightly coupled sequence, or if a concept feels incomplete without another, independence is compromised.

By adhering to these principles, concept design promotes a modular architecture where each unit is self-contained, reusable, and less prone to breaking when other parts of the system change.

***
