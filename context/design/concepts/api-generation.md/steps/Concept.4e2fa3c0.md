---
timestamp: 'Mon Oct 20 2025 01:43:55 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251020_014355.fa9ebe04.md]]'
content_id: 4e2fa3c0b4766f7afdce25f82570678dc810df5ef80e0e49074a313e47afcb7d
---

# Concept: PasswordAuth

* **concept**: PasswordAuth
* **purpose**: limit access to known users and establish point of contact.
* **principle**:  after a user registers with username, password, and establishes an email they can authenticate with that same username and password and be treated as the same user. Can also be contacted with the provided email address. Users can also change their password or email. Lastly users can "deactivate/delete their account".
* **invariant:**
  * no two Users have the same username
  * Every Credential corresponds to exactly one User with the same username
  * Every User has at most one Credential
* **state**:
  * A set of Users with
    * a `username`: String
    * an `email`:String
  * A set of Credentials
    * a `username`: String
    * a password:String
    * a user:User
* **actions**:
  * `register(username:String, password:String, email:String): (user:User)`
    * **requires**: no User or Credential exists with username
    * **effects**:
      * adds a new User(username, email) to Users, user
      * adds a new Credential(username, password, user) to Credentials
      * returns the new User, user
  * authenticate(username: String, password: String): (user:User)
    * **requires**: there exists a Credential with username and password
    * **effects**: returns the corressponding user
  * changePassword(username:String, currentPassword:String, newPassword:String)
    * **requires**: there exists a Credential c with username and password
    * **effects**: sets c.user.email to newPassword
  * changeEmail(username:String, password:String, newEmail:String)
    * **requires**: there exists a Credential c with username and password
    * **effects**: sets the email for the User of Credential c to newEmail
  * getEmail(username: String): String
    * **requires:** there exists a User with the given username
    * **effects:** returns the email field of the User with that username
  * isRegistered(username:String): Bool
    * **effects:** returns true if a User exists with the given username, otherwise false
  * deactivateAccount(username:String, password:String):
    * **requires**: there exists a Credential c with username and password
    * **effects**: remove the Credential with username and removes the User with username
