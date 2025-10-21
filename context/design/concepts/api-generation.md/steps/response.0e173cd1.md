---
timestamp: 'Mon Oct 20 2025 01:43:55 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251020_014355.fa9ebe04.md]]'
content_id: 0e173cd1ba5ef3bf82e910a5c22d3c33b9f288740e45d7f1c17c6a21ffe1051f
---

# response:

To ensure concepts are independent, follow these key principles outlined in the concept design background:

1. **No Direct Dependencies on Other Concepts**: A concept should not directly import or reference the implementation details (like classes or methods) of another concept. Its functionality must be entirely self-contained.
2. **Generic Parameters Only**: Concepts should operate on generic type parameters (like `User`, `Target`, `Item` in the examples) rather than concrete types from other concepts. This forces them to treat external objects as opaque identifiers, preventing assumptions about their internal structure or behavior.
   * For example, the `Comment` concept takes `[User, Target]` and doesn't know if `User` comes from `UserAuthentication` or `UserProfile`, or what properties a `User` object might have beyond its identity. It only cares about `User` values as unique IDs.
3. **Encapsulated State**: Each concept manages its own distinct state. There should be no shared mutable state or direct access to another concept's state. When two concepts deal with the same *entity* (e.g., `User`), they maintain separate "views" or "facets" of that entity in their respective states (e.g., `UserAuthentication` stores `username`/`password` for `User`s, while `UserProfile` stores `bio`/`thumbnail` for the *same* `User`s). These are distinct state relations.
4. **Single, User-Relevant Purpose**: A concept should have a clearly defined, narrow, user-focused purpose. This helps prevent "feature creep" where a concept tries to do too many things, potentially pulling in dependencies or concerns that belong elsewhere. The purpose should be evaluable and specific, acting as a boundary marker for its functionality.
5. **Behavioral Completeness**: A concept must embody *all* the functionality associated with its specific behavioral concern. It shouldn't rely on other concepts to complete its core purpose. If it needs to trigger or react to events from another concept, it does so through an external coordination mechanism (like a synchronization layer) that passes generic identifiers, not by directly calling methods on another concept's instance.
6. **Actions as Pre/Post Conditions**: The actions are defined in terms of their preconditions (what must be true before) and postconditions (what is true after), strictly referring to the concept's *own* state and generic parameters. This declarative style helps to focus on the concept's isolated behavior.

By adhering to these principles, particularly the use of generic parameters and strict separation of state, concepts are designed to be composable and reusable building blocks that can be developed and understood in isolation.

***
