test("create a couch", function () {
  createCouch("test", function (error, couch) {
    ok(!error);
  })
})

test("Add doc", function () {
  createCouch("test", function (error, couch) {
    ok(!error);
  })
})