---
timestamp: 'Mon Nov 03 2025 16:59:45 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251103_165945.f30126d8.md]]'
content_id: a9ce7d975e8a976e9f28fdf28a23c1bacde579c1d96515f7063b6f096e6cc9b0
---

# Concept: PasswordAuth

* **concept**: PasswordAuth \[User]
* **purpose**: limit access to known users and establish point of contact.
* **principle**:  after a user registers with username and password they can authenticate with that same username and password and be treated as the same user. Users can also change their password and "deactivate/delete their account".
* **invariant:**
  * no two Users have the same username
* **state**:
  * A set of Users with
    * a `username`: String
    * a `password`:String
* **actions**:
  * `register(username:String, password:String): (user:User)`
    * **requires**: no User exists with username
    * **effects**:
      * adds a new User(username, email) to Users, user
      * returns the new User, user
  * authenticate(username: String, password: String): (user:User)
    * **requires**: there exists a User with username and password
    * **effects**: returns the corressponding user
  * changePassword(username:String, currentPassword:String, newPassword:String)
    * **requires**: there exists a User u with username and password
    * **effects**: sets u.password to newPassword
  * isRegistered(username:String): Bool
    * **effects:** returns true if a User exists with the given username, otherwise false
  * deactivateAccount(username:String, password:String):
    * **requires**: there exists a User u with username and password
    * **effects**: remove the User with username and password
