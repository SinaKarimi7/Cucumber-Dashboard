@e2e @auth
Feature: User Authentication
  As a user
  I want to be able to log in and out
  So that I can access my account

  @smoke @login
  Scenario: Successful login
    Given I am on the login page
    When I enter username "john@example.com"
    And I enter password "secret123"
    And I click the login button
    Then I should see the dashboard
    And I should see "Welcome, John"

  @login @error
  Scenario: Failed login with invalid credentials
    Given I am on the login page
    When I enter username "wrong@example.com"
    And I enter password "wrongpass"
    And I click the login button
    Then I should see an error "Invalid credentials"
    And I should remain on the login page

  @logout
  Scenario: User logout
    Given I am logged in as "john@example.com"
    When I click the logout button
    Then I should be redirected to the login page
    And I should not see any user-specific content

  @password-reset @email
  Scenario: Request password reset
    Given I am on the login page
    When I click the "Forgot Password" link
    And I enter email "john@example.com"
    And I submit the reset request
    Then I should see confirmation "Password reset email sent"
