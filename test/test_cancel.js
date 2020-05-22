/**
 * Created by landoyjx on 2017/2/9.
 */
var OrderBook = require('../lib/orderbook');
var OrderCondition = require('../lib/types').OrderCondition;
var Order = require('../lib/order');

var book = new OrderBook();
var order = new Order(false, 1, 10);
book.add(order, OrderCondition.oc_no_conditions);
console.log(book.asks());
book.cancel(order);
console.log('-');
console.log(book.asks());