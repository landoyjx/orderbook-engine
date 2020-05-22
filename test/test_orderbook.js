/**
 * Created by landoyjx on 2017/2/8.
 */
var OrderBook = require('../lib/orderbook');
var OrderCondition = require('../lib/types').OrderCondition;
var Order = require('../lib/order');

var book = new OrderBook();
//for (var i = 1; i < 5; ++i) {
//    var order = new Order(true, i, 10);
//    book.add(order, OrderCondition.oc_no_conditions);
//}
//for (var i = 1; i < 6; ++i) {
//    var order = new Order(false, 3, 10);
//    book.add(order, OrderCondition.oc_no_conditions);
//}


var order1 = new Order(false, 1.00, 10);
book.add(order1, OrderCondition.oc_no_conditions, function (err, data) {
    //console.log(err, data);
});

//var order2 = new Order(true, 0, 0, 0, 0, 0, 0, 70);
var order2 = new Order(true, 1.00, 10);
book.add(order2, OrderCondition.oc_no_conditions, function (err, data) {
    console.log(err, data);
});
book.bids_.print();
console.log('---');
book.asks_.print();
console.log('\n\n');
console.log(book.asks());
console.log('-');
console.log(book.bids());
