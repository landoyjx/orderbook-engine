# OrderBook
Order book is used to match orders. It is an order book matching engine.

* add()
* cancel()
* replace()
* asks()
* bids()

## add
Add an new order to order book.

## cancel
Cancel an order.

## replace
Replace an order with new price and size_delta.

## asks
Get aggregate ask orders in form of market depth.

## bids
Get aggregate bid orders in form of market depth.

# Order
Order is item in order book engine.

* is_limit()
* is_buy()
* price()
* order_qty()
* state()
* open_qty()
* filled_qty()
* filled_cost()
* accept()
* cancel()
* replace()

# Types
Some enumeration types for engine to work.

* 

