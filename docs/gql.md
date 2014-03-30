---
layout: 2ColLeft
title: GQL Documentation
sidebar: nav.html
---

The Google Query Language (GQL) interface provides an alternative method for accessing data.
The version of GQL implemented here is based on the Google Visualization API Query Language
(https://developers.google.com/chart/interactive/docs/querylanguage).
The syntax of GQL queries should be familiar to those who have used SQL,
but the capabilities of GQL are much more limited.

GQL queries are performed by passing a query object to the gql method along with a callback.
Callbacks are in the node.js idiom of `function(err, data)` Where the first argument will be undefined
unless there is an error, and further arguments specify the result.
Note that only identifiers and string literals are case-sensitive.

### Language Syntax

 * [Select](#select)
 * [Where](#where)
 * [Group By](#groupBy)
 * [Pivot](#pivot)
 * [Label](#label)
 * [Functions](#functions)
  * [Aggregation Functions](#aggregation_functions)
  * [Scalar Functions](#scalar_functions)
  * [Arithmetic Operators](#arithmetic_operators)
 * [Miscellaneous](#miscellaneous)
  * [Literals](#literals)
  * [Identifiers](#identifiers)
  * [Reserved Words](#reserved_words)

## Perform a Query

    db.gql(query, [options], [callback])

Although only the query is mandatory, the callback is required to access the query result.
Currently no query options are implemented.

    var pouchdb;
    PouchDB('idb://test', function(err, db) {
       pouchdb = db;
      // Use pouchdb to call further functions
        db.gql({select: "*", where: "type='Fire' and name is not null"}, function(err, result){
            if(!err){
            // Use the results of the query here
            }
          }
    })

## Select

    db.gql({select: "`name!`, price-discount, upper(vendor)"}, callback)

Select returns an object for each document in the database (unless limited by another clause).
Each of these objects will be populated with the properties specified in the select clause.
Arithmetic operators, aggregation functions, and scalar functions are all fair game.
Properties that are missing from an object in the database are assigned null.

With these documents in the database

    {name!: "pencil", price: 2, discount: 0.7, vendor: "store1"},
    {name!: "pen", price:3, discount: 2, vendor: "store2"}

The above query will return

    {name!: "pen", price - discount: 1, upper(vendor): "STORE2"},
    {name!: "pencil", price - discount: 1.3, upper(vendor): "STORE1"}


## Where

    db.gql({select: "*", where: "type='Fire' and name is not null"}, callback)

Where allows filtering of the objects that are passed to the select clause.  In this way, unwanted documents
can be excluded from the query result.  The where clause is composed of conditions which are joined by the
logical operators AND and OR.  An additional operator, NOT, provides negation.

Comparison operators can be used in conditions to perform comparisons.  The supported comparison operators are
<=, <, >, >=, !=, and <>.  != and <> are equivalent.  Null is treated slightly differently; to check if
something is null IS NULL is used.  To check if something is not null, IS NOT NULL is used.

With these documents in the database

    {name: "charmander", type: "Fire"},
    {type: "Fire", attack:"tail whip"},
    {name: "charizard", type: "Fire", attack:"slash"}

The above query will return

    {_id: "0D715E2C-CEDD-46B4-A060-9C9C290BEBE8", _rev: "1-71d1e0f8ab00cf432306890a4116602b",
    attack: "slash", name: "charizard", type: "Fire"},
    {_id: "3153F94B-0568-4D4C-BFA1-83EDF6185915" _rev: "1-d24f7405c5a63943391eaff9a260139c",
    name: "charmander", type: "Fire"}

Note the inclusion of the \_rev and \_id fields.  This is the result of using 'select \*' instead of naming the
desired fields explicitly.

## Group By

    db.gql({select: "max(charizard), charmeleon", groupBy: "charmeleon"}, callback)

Group by creates one object for each unique combination of values in the group by clause. For the query above,
if every document in the database had the value "Level 22" for the property "charmeleon", only a single
object would be generated.

If a group by clause is present, every identifier in the select clause must either be the argument of an
aggregation function or present in the group by clause.  Otherwise, the composite objects formed by the group by
clause could have multiple values for some identifiers.

With these documents in the database

    {charizard: 50, charmander: 24, charmeleon: 2, haunter:true},
    {charizard: 40, charmeleon: 2, charmander: 50},
    {charizard: 7, charmeleon: 20, charmander: 15}

The above query will return

    {charmeleon: 2, max(charizard): 50}
    {charmeleon: 20, max(charizard): 7}

## Pivot

     db.gql({select: "max(charizard)", pivot: "charmeleon"}, callback)

Pivot is essentially group by for properties.  Each distinct value in the pivot clause gets its own property.
Unless used with group by, the result will have only a single document.

The same restriction for group by applies here; every identifier in the select clause must either be the
argument of an aggregation function or preset in the group by clause.  Additionally, identifiers in the pivot
clause may not be used in the group by clause.

Note that using pivot will generate novel property names.  See below for an example.

With these documents in the database

    {charizard: 50, charmeleon: "hello"},
    {charizard: 40, charmeleon: "hello"},
    {charizard: 7, charmeleon: "world", charmander: 15}

The above query will return

    {'hello max(charizard)': 50, 'world max(charizard)': 7}

## Label

     db.gql({select: 'upper(dept), charizard',
     label: "upper(dept) 'Department', charizard 'Maximum Charizard!'"}, callback)

Label is used to transform cryptic identifiers into something that can be displayed directly to the end user.
Items in the label clause can be identifiers, aggregation functions, scalar functions, or operators.  The label
clause is composed of any number of statement label pairs, where the statement corresponds to some statement in
the select clause and the label is a string literal.

With these documents in the database

    {charizard: 50, dept: "eng", lunch:"2"},
    {charizard: 40, lunch: "1", dept: "market"},·
    {charizard: 99, dept: "eng", lunch: 1},
    {charizard: 7, dept: "eng", lunch: 2}

The above query will return

    {Department: "ENG", Maximum Charizard!: 7},
    {Department: "ENG", Maximum Charizard!: 99},
    {Department: "MARKET", Maximum Charizard!: 40},
    {Department: "ENG", Maximum Charizard!: 50}

## Functions

GQL contains a number of operators and functions that can operate on retrived documents.

### Aggregation Functions

    db.gql({select: "max(charizard), min(charizard), average(charizard), count(charizard), sum(charizard)"},
    callback)

The currently supported aggregation functions are avg, count, max, min, and sum.  Each of these takes a single
statement as an argument.  A statement can be composed of one or more identifiers joined by operators.
Avg and sum expect their arguments to evaluate to numbers; the other aggregators will accept any type of input.
Aggregation functions operate on entire identifiers, returning only a single property. Aggregation functions
may only appear in the select and label clauses.

With these documents in the database

    {charizard: 50},
    {charizard: 40},
    {charizard: 7}

The above query will return

    {average(charizard): 32.333333333333336, count(charizard): 3, max(charizard): 50,
    min(charizard): 7, sum(charizard): 97}

### Scalar Functions

    db.gql({select: "`name!`, price-discount, upper(vendor)"}, callback)

Currently only two scalar functions are supported, upper and lower.  These change the characters in their inputs
to uppercase and lowercase respectively.  Unlike aggregator functions, scalar functions take only a single
identifier as their input.  Scalar functions may only appear in the select and label clauses.

With these documents in the database

    {name!: "pencil", price: 2, discount: 0.7, vender: "store1"},
    {name!: "pen", price:3, discount: 2, vendor: "store2"}

The above query will return

    {name!: "pen", price - discount: 1, upper(vendor): "STORE2"},
    {name!: "pencil", price - discount: 1.3, upper(vendor): "STORE1"}


### Arithmetic Operators

    db.gql({select: "*", where: "charizard <=charmander * charmeleon + 2 and (charmander - 7 !=  24/3)"},
    callback)

Arithmetic operators are used to perform basic math on the values from documents.  Their arguments must be
numbers.  Arithmetic operators may only appear in the select, label, and where clauses.  The arguments are
implicitly upcast to floats if necessary. The supported arithmetic operators are:

* Addition: '+'
* Subtraction: '-'
* Multiplication: '\*'
* Division: '/'


With these documents in the database

    {charizard: 50, charmander: 24, charmeleon: 2, haunter:true},
    {charizard: 40, charmeleon: .5, charmander: 50},
    {charizard: 7, charmeleon: 20, charmander: 15}

The above query will return

    {charizard: 50, charmander: 24, charmeleon: 2, haunter: true}

## Miscellaneous

Some features that are not covered in other sections.

### Literals

Literals are used for comparison or arithmetic.  These are the supported literals:

* string: Any characters surrounded by single or double quotes
* number: Numbers in regular decimal form.  They may have a single period, a single negative sign, and no commas
* boolean: Either true or false

### Identifiers

Identifiers correspond to the properties of documents in the database.  There are strict rules governing the
way that identifiers can be expressed in queries.  If your identifier has spaces, is a reserved word, contains
any characters that are not letters or numbers or underscores, or starts with a digit, it must be surrounded
by backquotes \(\`identifier\`\).

### Reserved Words

This is the current list of reserved words.  Because the GQL implementation is currently under development,
this list is likely to grow over time.

    and
    asc
    by
    date
    datetime
    desc
    false
    format
    group
    label
    limit
    not
    offset
    options
    or
    order
    pivot
    select
    timeofday
    timestamp
    true
    where
