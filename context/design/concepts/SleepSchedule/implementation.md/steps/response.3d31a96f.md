---
timestamp: 'Sun Oct 12 2025 16:22:30 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251012_162230.d7629bf9.md]]'
content_id: 3d31a96f293103e768f4bb6bb156e3256d3b2b16e1869341a63c9571b9f7d4a0
---

# response:

To ensure your concepts are independent, you must adhere to several core principles and design choices inherent to the concept design methodology:

1. **Strict Independence of Dependencies and State:**
   * Concepts are fundamentally designed to be "completely independent of one another in terms of dependencies and state." This is a foundational rule.
   * **Implementation Rule:** "No import statements can reference another concept in any way, including type declarations." This is the most concrete rule for enforcing independence at the code level. A concept's implementation cannot directly call methods, access state, or even declare types from another concept.

2. **Use of Generic Type Parameters:**
   * Concepts "work off generic parameters, and cannot know about specific types."
   * When a concept takes type parameters (e.g., `concept Comment [User, Target]`), it must treat these types "completely polymorphically." This means the concept cannot assume these types have *any* properties or methods; it can only compare them to determine if two instances represent the same identifier/reference. This prevents a concept from becoming coupled to the internal structure or behavior of entities managed by other concepts.

3. **Single, User-Relevant Purpose:**
   * Each concept must have "a single purpose" that is "strongly grounded in a user-relevant purpose, and not just a structure for software."
   * By focusing on a single, well-defined user need, concepts naturally delineate distinct areas of functionality. This prevents a concept from becoming a catch-all that implicitly depends on various unrelated functionalities.

4. **Behavioral Completeness for its Purpose:**
   * "A concept must embody all the functionality associated with a behavioral concern, unlike objects which often depend on other objects for their functioning."
   * This means a concept should be self-contained in fulfilling its stated purpose. It shouldn't require another concept to perform part of its core function. For example, the `Labeling` concept includes actions to create, add, and delete labels, making it a complete unit for that concern.

5. **Separation of Concerns and Different Views:**
   * "Concepts separate concerns, unlike objects in object oriented programming which tend to aggregate all properties and methods associated with a class of object."
   * Concepts often represent "different aspects of an object," or "different views of a user." For instance, a `UserAuthentication` concept might manage a user's `username` and `password`, while a `UserProfile` concept manages their `bio` and `thumbnail`. Both concern `User` entities, but they manage distinct, non-overlapping aspects without one concept directly depending on the other's internal state or implementation details.

6. **Self-Contained State:**
   * Each concept explicitly defines its `state`, which "comprises what the executing concept remembers about the actions that have occurred."
   * This state is local to the concept and should not include information that is the primary responsibility of another concept. The `Labeling` concept, for example, holds its own mappings of `Items` to `Labels`, rather than requiring `Item` objects to hold their own `labels` directly.

By strictly following these guidelines, especially the rule against referencing other concepts in code and by designing for generic types and single, complete purposes, you ensure that concepts remain independent, reusable, and easier to reason about in isolation.
