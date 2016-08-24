---
layout: post

title: How we test PouchDB

author: Dale Harvey

---

While working on and researching improvements for automated testing in PouchDB, I found a lack of blog posts and general information about how open-source libraries test themselves. With PouchDB, a huge amount of effort has gone into testing, but we haven't talked about it much outside the project. So I wanted to explain a little about our approach.

### How do we test PouchDB?

Every pull request and check-in to the PouchDB repository goes through the following test run:

{% include img.html href="https://travis-ci.org/pouchdb/pouchdb/builds/40528881" src="travis-screenshot.png" alt="Travis Passing Screenshot" %}

This combination of tests takes around 6 hours running time and covers the minimal options we have found to be confident in not introducing regressions. We test PouchDB against plain CouchDB 1.6.0 on the most popular modern browsers and Node.js, as well as testing alternative backends, servers and options (LocalStorage, PouchDB Server, auto-compaction, etc.). Ideally we would run a full matrix of configurations, however we are hitting the upper limit on how long our tests take to run, so we have picked the ones most likely to surface regressions.

### Why care?

Hopefully I don't need to espouse most of the virtues of testing; things that change and aren't tested are usually broken. PouchDB is fairly complex, so we rely on a comprehensive test suite, primarily to ensure we don't introduce regressions as we work on the code.

With PouchDB, however, I have found an added benefit is enabling contributors. By improving our test infrastructure, we make it easier for contributors to have a clear process for verifying behaviour as bugs, writing a failing test and then confirming a fix.

Being confident in your test suite's ability to catch regressions enables us to accept contributions in a reasonable time frame. If we are ever unsure of whether a contribution may break a particular feature, then we use that as an indication to improve the tests in that area, not as a reason to avoid merging the contribution.

### Test library

We use [Mocha](http://mochajs.org/) to write almost all of our tests. Mocha has become pretty much the de-facto library for testing JavaScript, and it has worked really well for us.

If I had one complaint about Mocha, it would be I often find myself seeing `does not equal [object Object]` as its output too often. Some assertion libraries are better than others, but I rarely remember which. We previously used [QUnit](http://qunitjs.com/), but its Node support was sub-par. I experimented with [Tape](https://www.npmjs.org/package/tape) and it was by far the [easiest to get setup to run in the browser and Node](http://substack.net/how_I_write_tests_for_node_and_the_browser), however it is opinionated, and if you deviate from the expected workflow, we found it got in the way more than it helped.

### Test platform

Our tests run on every check-in and PR on [Travis CI](travis-ci.org). Travis an amazing platform; it was easy to get up and running and has been incredibly stable. PouchDB would be nowhere near the state it is today without it.

However, we are beginning to outgrow Travis's free open-source capacity, and the paid options are prohibitively expensive. So we are beginning to look around for self-hosted alternatives, albiet without a lot of options.

[Travis is open-source](https://github.com/travis-ci/travis-ci), however it is not a well-setup project for self-hosting &ndash; there isn't so much as a README to get started with. We previously used [Jenkins](http://jenkins-ci.org/), however I found it a huge maintenance burden. It's very possible someone with more experience in Jenkins could do a better job, though, and I am also keeping an eye on [Strider](http://stridercd.com/) as a possible alternative.

### Test runner

We use [Selenium](http://www.seleniumhq.org/) to drive tests in the browser, and [Saucelabs](https://saucelabs.com/) to run the browsers that we can't run locally. Saucelabs is great, however due to the nature of our tests, we generate a lot of HTTP traffic that needs to be proxied back to Travis, which has been a common point of failure.

We are also finding some platforms (particularly iPhone and Internet Explorer) will become unstable on Saucelabs. The errors almost always come from our code, but it is hard to maintain a reliable test suite when the underlying platform changes and you have little control over it.

Before settling on Selenium, I had previously tried out [Testling](https://ci.testling.com/), and similiarly to Tape it was very easy to get started but opinionated. It was also broken on OSX with pull requests containing fixes that hadn't been touched for months. Selenium had the advantage that it was very widely used, and new frameworks or platforms are likely to have WebDriver support early on.

I have however found Selenium as a project fustrating to use, from the first time visiting [http://www.seleniumhq.org/](http://www.seleniumhq.org/) to understanding what I needed to download and write a first test that started a browser, it was an unclear and confusing process. Even today getting ChromeDriver started correctly gets me confused, also the download cost of 30MB for what is mostly a proxy server is an annoyance.

I would love to see a project wrap up Selenium / ChromeDriver and possibly Cordova / Appium into a nice, well-documented module that installs and boots your browser(ish) platform of choice, ready to be driven by Selenium tests.

### Performance tests

Performance testing has been troublesome for PouchDB. We have a performance test suite, but it has been hard to integrate it into our CI process, which means it is not comprehensive and often forgotten.

The issue with running in CI is that Travis is set up to run one test per commit, and every time there is a change to the test suite, its data needs to be backfilled in order to properly compare versions. There is also the fact that Saucelabs and Travis may change their running environment at any time, which makes comparisons over time useless.

I expect that to fix this, we will need to run the tests on dedicated hardware and give performance tests some ability to choose which version of PouchDB to test, along with some helper scripts to backfill the performance data.

### And done.

Hopefully that gives a little insight into the process and issues we have with testing. It's a long and ongoing process, and I am hoping that the work we do to improve our testing infrastructure can be reused by other projects.

We would love to hear more about the tools, techniques and issues that other similiar projects have come across while working on their tests. If you have anything to share, please send it along to [@pouchdb](https://twitter.com/pouchdb).
