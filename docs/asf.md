# ASF Podling Proposal for PouchDB

## Abstract

PouchDB is an open-source JavaScript database inspired by [Apache CouchDB]
(http://couchdb.apache.org/) that is designed to build offline-capable web
applications.


## Proposal

PouchDB is an open-source JavaScript database inspired by [Apache CouchDB]
(http://couchdb.apache.org/) that is designed to run well within the browser.
PouchDB was created to help web developers build applications that work as
well offline as they do online.


### Background

Established in 2010, PouchDB has been designed as both a first-class document
database for use in a web browser as well as a first-class data replication
peer to Apache CouchDB. PouchDB’s JavaScript API closely mirrors CouchDB’s REST
API and CouchDB’s peer-to-peer data synchronisation protocol allows web
developers to build database driven applications that work when the web browser
is offline. The replication protocol handles seamless data reconciliation when
one or more peers reconnect after being offline. Peers can be other web
browser by replicating via WebRTC, or one or more CouchDB instances.

### Rationale

PouchDB has always been a sister project to Apache CouchDB. Since its inception,
it has changed lead maintainers three times, all of which were informally
running the project on its GitHub repository. With ever increasing popularity
and reliance by mission-critical projects, PouchDB is looking for an open source
foundation to join and has selected the ASF to be close to CouchDB.


### Initial Goals

PouchDB aims to benefit from the ASF’s mature and transparent project- and
community-management policies.


### Current Status

#### Meritocracy

PouchDB has always, if informally, rewarded contributors that have a persistent
contribution history with commit access to the project directly. Over its 15-
year history, core and occasional contributors have come and gone, while an
active set of PouchDB practitioners has always looked after the project itself.


#### Community

PouchDB comes with an existing and robust developer and user community. By
establishing transparent community guidelines, we hope to grow this community
even further.


#### Core Developers

PouchDB is currently maintained by a handful of experienced developers that
have a long history in open source. The current interim project lead is an ASF
member and PMC Chair for Apache CouchDB. All developers are at least also end-
users of Apache CouchDB, while some of them have also been active contributors
on CouchDB.


#### Alignment

PouchDB is an established project that looks for long-term stability and the ASF
provides nothing but. PouchDB is used in various mission-critical projects and
would like to benefit from ASF stewardship as a means of making it easier to be
relied on long-term. PouchDB is also Apache 2 licensed already.


### Known Risks

PouchDB’s main risk is stagnation through developer abandonment. In its history
PouchDB had high- medium and low-velocity timespans, but it has always attracted
enough developers (both volunteer and for-pay) to stay afloat. Most recently,
PouchDB is at medium-velocity. Again, the PouchDB project hopes that by
formalising project management structures, a long-term stability and
dependability can be achieved.


#### Project Name

PouchDB is a tongue-in-cheek pun on its sister project CouchDB. The current
holder of the project domain (pouchdb.com) and previous project lead Dale
Harvey is on board with transferring any naming rights to the ASF.


#### Orphaned Products

The current PouchDB maintainers already consist of representatives from various
distinct organisations with strong technical and financial incentives to keep
PouchDB actively maintained. It is unlikely that a significant number would up
and leave the project.


#### Inexperience with Open Source

PouchDB is an existing open source project and its maintainers consist mostly of
very experienced developers, including some with over 15 years in active open
source development and one ASF Member and committer since 2008. For other
maintainers, PouchDB was their first open source projects and they have since
contributed to various other projects as well based on their good experience
with PouchDB.


#### Length of Incubation

The project aims to graduate within 6–12 months based on the experience of the
Apache CouchDB incubation in 2008 and general maturity of the project itself.


#### Homogenous Developers

The current PouchDB maintainers consist of people from around the world,
collaborating across all timezones.


#### Reliance on Salaried Developers

There is also a healthy mix of maintainers some of which are paid to work on
PouchDB part time, but everyone also contributes in their spare time.


#### Relationships with Other Apache Products

PouchDB has been developed as a sister-project to Apache CouchDB. Both projects
are inextricably linked in the sense that every PouchDB user is at least also a
CouchDB user. The reverse is not necessarily true, but in a recent CouchDB
developer survey, 80% of participants stated to use PouchDB with CouchDB.

The question of whether PouchDB should join CouchDB as as sub-project has been
raised and it has been decided to not pursue this option. Both projects have
significant technical differences (CouchDB is written in Erlang and PouchDB is
written in JavaScript) so that a joint stewardship would raise more problems
than it solves. Both the PouchDB and CouchDB maintainers agree on this point.
Where needed (APIs, sync protocol), the two teams have worked together tightly
and productively in the past. We don’t see a need to formalise this relationship
to achieve future success.


#### A Excessive Fascination with the Apache Brand

As mentioned before, PouchDB is looking for an open source foundation that helps
with long-term project stability and dependability. Both the OpenJS Foundation
and the ASF have been evaluated. In the end, the PouchDB developers prefer the
close proximity to Apache CouchDB. The maintainers believe that people having
to make decision about whether to bet on a PouchDB/CouchDB development stack or
not will have an easier time integrating both projects from a single foundation.
If the ASF won’t have PouchDB, we are happy to reconsider alternatives.

### Documentation

Project website: https://pouchdb.com/
Including blog with release announcements: https://pouchdb.com/blog
GitHub Project: https://github.com/pouchdb/pouchdb

### Initial Source

The initial source tree lives at https://github.com/pouchdb/pouchdb


### Source and Intellectual Property Submission Plan

The PouchDB maintainers have yet to decide if they want to migrate the existing
repository to the ASF GitHub organisation or if they want to submit a pristine
copy, but either way, submitting the source code is a few git commands away.

The pouchdb.com domain currently held by Dale Harvey is being transferred
to Neighbourhoodie Software which also holds the couchdb.com/net/org domains
in escrow for the Apache CouchDB project. ASF Member and CouchDB PMC Chair Jan
Lehnardt is a shareholder and chief executive at Neighbourhoodie and they are
trusted to hold and manage those domains in escrow until such time a transition
is needed. The website publishing toolchain can be easily adapted to the ASF-
provided web publishing mechanisms.


#### External Dependencies

PouchDB depends directly on the following other projects. An automated licensing
scan has revealed the following set of licenses in the dependency tree

Runtime dependencies: three dependencies with to-be-sorted-out licenses
- argsarray (WTFPL), trivially replaced with a compatible version.
- fetch-cookie (Unlicense, public-domain), could be fine, but check with ASF.
- readable-stream (incorrectly labelled BSD license), newer versions are MIT
  licensed, we should upgrade.

Development dependencies: if applicable, we’ll need to go through those and see
what can be done about them

- argparse@2.0.1: Python-2.0
- chai-as-promised@5.3.0: WTFPL
- configstore@0.3.2: Invalid SPDX expression "BSD"
- cookie@0.1.2: Invalid license metadata
- cssmin@0.4.3: Invalid license metadata
- escape-html@1.0.1: Invalid license metadata
- esprima-fb@15001.1.0-dev-harmony-fb: Invalid license metadata
- estraverse@1.9.3: Invalid license metadata
- event-stream@0.5.3: Invalid license metadata
- fetch-cookie@2.2.0: Unlicense
- jsonify@0.0.1: Invalid SPDX expression "Public Domain"
- JSONStream@0.10.0: Invalid license metadata
- log-driver@1.2.5: Invalid license metadata
- mime@1.2.11: Invalid license metadata
- ms@0.7.0: Invalid license metadata
- ms@0.6.2: Invalid license metadata
- pako@1.0.11: (MIT AND Zlib)
- path-to-regexp@0.1.3: Invalid license metadata
- ps-tree@0.0.3: Invalid license metadata
- qs@2.3.3: Invalid license metadata
- random-uuid-v4@0.0.8: Unlicense
- semver@2.3.2: Invalid SPDX expression "BSD"
- sntp@1.0.9: Invalid license metadata
- source-map@0.2.0: Invalid license metadata
- truncate-utf8-bytes@1.0.2: WTFPL
- tslib@2.6.3: 0BSD
- tweetnacl@0.14.5: Unlicense
- update-notifier@0.1.10: Invalid license metadata

These are produced with the `licensee` tool, invocations for runtime
dependencies:

```
licensee --corrections --errors-only --production
```

and for development dependencies:

```
licensee --corrections --errors-only
```

With the following licenses being permitted

- Apache-2.0
- MIT
- BSD-2-Clause
- BSD-3-Clause
- ISC
- BSD

#### Cryptography

PouchDB does not directly include cryptography code, but makes use of in-browser
TLS. A PouchDB plugin crypto-pouch exists that does record-level encryption, but
it is currently not part of the PouchDB code base. If md5 hashing is considered
cryptography, PouchDB, like CouchDB, makes use of that, just note that md5
hashing is not used for security relevant operations.


### Required Resources

#### Mailing lists

* dev@pouchdb.incubator.apache.org
* private@pouchdb.incubator.apache.org
* commits@pouchdb.incubator.apache.org


#### Subversion Directory

n/a


#### Git Repositories

* https://gitbox.apache.org/repos/asf/incubator-pouchdb.git
* https://github.com/apache/incubator-pouchdb.git


#### Issue Tracking

GitHub Issues


#### Other Resources

PouchDB makes significant use of GitHub Actions for CI. For 2024, we have used
214,556 total minutes across 53,831 job runs. This can be migrated to another
setup if need be but it’d be great if this carefully crafted setup could remain
in place.


### Initial Committers

Alba Herrerías Ramírez albaherreriasdev at gmail dot com
Alex Anderson alexanderandersonofandover at gmail dot com
Diana Belle garbados at apache dot org (CLA)
Diana Barsan twisteddiana at gmail dot com
Gareth Bowen gareth at bowenwebdesign dot co dot nz
Jan Lehnardt jan at apache dot org (CLA)
James Coglan james at neighbourhood dot ie
Johannes Schmidt schmidt at tf-fabrik dot de
Steven-John Lange sourcer85 at gmail dot com


### Sponsors

Alba Herrerías Ramírez Neighbourhoodie Software
Alex Anderson independent, formerly Medic
Diana Belle independent
Diana Barsan Medic
Gareth Bowen independent, formerly Medic
Jan Lehnardt Neighbourhoodie Software
James Coglan Neighbourhoodie Software
Johannes Schmidt Mozilla / independent
Steven-John Lange HZData GmbH / independent


#### Champion

Jan Lehnardt, CouchDB PMC Chair.


#### Nominated Mentors

PJ Fanning (fanningpj at apache dot org)
Jean-Baptiste Onofré (jb at nanthrax dot net)


#### Sponsoring Entity

The Incubator
