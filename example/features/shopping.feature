Feature: Sample Shopping Cart
  As a customer
  I want to manage my shopping cart
  So that I can purchase items

  Scenario: Add item to cart
    Given I am on the homepage
    When I click the "Add to Cart" button
    And I enter 3 items
    Then I see 3 items in my cart
    And the total is "$45.00"

  Scenario: Remove item from cart
    Given I have 5 items in my cart
    When I remove 2 items
    Then I see 3 items in my cart

  Scenario: Empty cart
    Given I have items in my cart
    When I click the "Clear Cart" button
    Then I see 0 items in my cart
    And the cart is empty
