/**
 * Created by landoyjx on 2017/2/9.
 */
var OrderBook = require('../lib/orderbook');
var OrderCondition = require('../lib/types').OrderCondition;
var Order = require('../lib/order');
var OrderPrice = require('../lib/types').OrderPrice;

var book = new OrderBook();
for (var i = 1; i < 5; ++i) {
    var order = new Order(true, i, 10);
    book.add(order, OrderCondition.oc_no_conditions);
}
for (var i = 5; i < 9; ++i) {
    var order = new Order(false, i, 10);
    book.add(order, OrderCondition.oc_no_conditions);
}
console.log(book.market_depth());
console.log('\n');

var order = new Order(false, 5, 10); // sell
book.add(order, OrderCondition.oc_no_conditions);
console.log(book.market_depth());

// (1, 10) -> (2, 1)
book.replace(order, 1, 3, function(err, ret) {
    //console.log(err);
    //console.log(ret);
});
console.log('\n');
console.log(book.market_depth());
