# ASF Podling Proposal

Original copy: https://cwiki.apache.org/confluence/display/INCUBATOR/New+Podling+Proposal

## Abstract

Commentary:
A short descriptive summary of the project. A short paragraph, ideally one
sentence in length. The abstract should be suitable for reuse in the board
resolution used to create the official project upon graduation, as the first
paragraph on the podling web site and in the DOAP document.

Examples:
> Geronimo will be a J2EE compliant container.

> Heraldry will develop technologies around the emerging user-centric identity
space.

> Yoko will be a CORBA server.

PouchDB:
PouchDB is an open-source JavaScript database inspired by [Apache CouchDB]
(http://couchdb.apache.org/) that is designed to build offline-capable web
applications.


## Proposal

Commentary:
A lengthier description of the proposal. Should be reasonably declarative. More
discursive material should be included in the rationale (or other later
sections).

Example:
> XAP is to provide an XML-based declarative framework for building, deploying
and maintaining rich, interactive, Ajax-powered web applications. A basic
principle of XAP is to leverage existing Ajax...

PouchDB:
PouchDB is an open-source JavaScript database inspired by [Apache CouchDB]
(http://couchdb.apache.org/) that is designed to run well within the browser.
PouchDB was created to help web developers build applications that work as
well offline as they do online.


### Background

Commentary:
Provides context for those unfamiliar with the problem space and the history of
the project. Explain terms whose meanings may be misunderstood (for example,
where there is not a single widely adopted definition). This content should be
capable of being safely ignored by domain experts. It should probably find an
eventual home on the Podling website.

Example (Heraldry):
> To provide some background, the Higgins Project is being actively developed
within Eclipse and is a framework that will enable users and enterprises to
integrate identity, profile, and relationship information across multiple
systems. Using context providers, existing and new systems such as directories,
collaboration spaces

PouchDB:
Established in 2010, PouchDB has been designed as both a first-class document
database for use in a web browser as well as a first-class data replication
peer to Apache CouchDB. PouchDB’s JavaScript API closely mirrors CouchDB’s REST
API and CouchDB’s peer-to-peer data synchronisation protocol allow web
developers to build database driven applications that work when the web browser
is offline. The replication protocol allows for seamless data reconciliation
when one or more peers reconnect after being offline. Peers can be other web
browser by replicating via WebRTC, or CouchDB instances.

### Rationale

Commentary:
Explains why this project needs to exist and why should it be adopted by Apache.
This is the right place for discursive material.

Example (Beehive):
>There is a strong need for a cohesive, easy-to-use programming model for
building J2EE applications. Developers new to Java are forced to learn a myriad
of APIs just to build simple applications; advanced J2EE developers are forced
to write tedious plumbing code; and tools authors are limited in what they can
do to simplify the experience due to the underlying complexity.

PouchDB:
PouchDB has always been a sister project to Apache CouchDB. Since its inception,
it has changed lead maintainers three times, all of which were informally
running the project on its GitHub repository. With ever increasing popularity
and reliance by mission-critical projects, PouchDB is looking for an open source
foundation to join and has selected the ASF to be close to CouchDB.

### Initial Goals

Commentary:
A complex proposal (involving multiple existing code bases, for example) may
cause concerns about its practicality. A good way to address these concerns is
to create a plan that demonstrates the proposal is feasible and has been
carefully thought through.

Many projects will not need this section.

Example (Heraldry):
> Expansion of Yadis and OpenID libraries into additional languages beyond the
existing Python, Ruby, Perl, and PHP libraries > OpenID authentication
specification revision to fix known security considerations, investigate
compatibility with the DIX IETF proposal, describe Yadis integration, and allow
either an URL or XRI be used as the End User's Identifier

PouchDB:
PouchDB aims to benefit from the ASF’s mature and transparent project- and
community-management policies.

### Current Status

Commentary:
This section (and the contained topics) describes the candidate's current status
and development practices. This should be an honest assessment balancing these
against Apache's principles and development ideals.

For some proposals, this is a chance to demonstrate an understanding of the
issues that will need to addressed before graduation. For others, this is a
chance to highlight the close match with Apache that already exists. Proposals
without an initial code base should just simply state that.

Some proposals name this section criteria (though the term is a little
misleading).

#### Meritocracy:

Commentary:
Apache is a meritocracy.

Once a developer has submitted enough good patches, then it should be natural
that they are elected to committer. It should be natural that active committers
are elected to the project management committee (PMC).

This process of renewal is vital to the long term health of Apache projects.
This is the right place to demonstrate that this process is understood by the
proposers.

Example (OFBiz):

> OFBiz was originally created by David E. Jones and Andy Zeneski in May 2001.
The project now has committers and users from around the world. The newer
committers of the project joined in subsequent years by initially submitting
patches, then having commit privileges for some of the applications, and then
privileges over a larger range of applications.

Example (Beehive):

>We plan to do everything possible to encourage an environment that supports a
meritocracy. One of the lessons that the XMLBeans committers have learned is
that meritocracies don't just evolve from good intentions; they require actively
asking the community for help, listing/specifying the work that needs to be
done, and keeping track of and encouraging members of the community who make any
contributions...

PouchDB:
PouchDB has always, if informally, rewarded contributors that have a persistent
contribution history with commit access to the project directly. Over its 15-
year history, core and occasional contributors have come and gone, while an
active set of PouchDB practitioners has always looked after the project itself.


#### Community:

Commentary:
Apache is interested only in communities.

Candidates should start with a community and have the potential to grow and
renew this community by attracting new users and developers. Explain how the
proposal fits this vision.

Example (Beehive):
> BEA has been building a community around predecessors to this framework for
the last two years. There is currently an active newsgroup that should help us
build a new community at Apache.

Example (WebWork2):
> The WebWork 2 community has a strong following with active mailing lists and
forums.

Example (WADI):
> The need for a full service clustering and caching component in the open
source is tremendous as its use can be applied in many areas, thus providing the
potential for an incredibly large community.

PouchDB:
PouchDB comes with an existing developer and user community. By establishing
transaprent community guidelines, we hope to grow this community even further.

#### Core Developers:

Apache is composed of individuals.

It is useful to provide a brief introduction to the developers on the initial
committers list. This is best done here (and not in that section). This section
may be used to discuss the diversity of the core development team.

Example (ServiceMix)
> The core developers are a diverse group of developers many of which are
already very experienced open source developers. There is at least one Apache
Member together with a number of other existing Apache Committers along with
folks from various companies. http://servicemix.org/Team

Example (WADI)
> WADI was founded by Jules Gosnell in 2004, it now has a strong base of
developers from Geronimo, Castor, OpenEJB, Mojo, Jetty, ActiveCluster, ActiveMQ,
and ServiceMix.

PouchDB:
PouchDB is currently maintained by a handful of experienced developers that
have a long history in open source. The current interim project lead is an ASF
member and PMC Chair for Apache CouchDB. All developers are at least also end-
users of Apache CouchDB, while some of them have also been active contributors
on CouchDB.


#### Alignment:

Describe why Apache is a good match for the proposal. An opportunity to
highlight links with Apache projects and development philosophy.

Example (Beehive):
> The initial code base is targeted to run within Tomcat, but the goal is to
allow the framework to run on any compliant Servlet or J2EE container. The Web
services component, based on JSR-181, will leverage Axis. The NetUI component
builds on top of Struts. The underlying Controls component framework uses
Velocity. There are other projects that we will need to work with, such as the
Portals and Maven projects.

PouchDB:
PouchDB is an established project that looks for long-term stability and the ASF
provides nothing but. PouchDB is used in various mission-critical projects and
would like to benefit from ASF stewardship as a means of making it easier to be
relied on long-term. PouchDB is also Apache 2 licensed already.

### Known Risks

An exercise in self-knowledge. Risks don't mean that a project is unacceptable.
If they are recognized and noted, then they can be addressed during incubation.

PouchDB:
PouchDB’s main risk is stagnation through developer abandonment. In its history
PouchDB had high- medium and low-velocity timespans, but it has always attracted
enough developers (both volunteer and for-pay) to stay afloat. Most recently,
PouchDB is at medium-velocity. Again, the PouchDB project hopes that by
formalising project management structures, a long-term stability and
dependability can be achieved.


#### Project Name

Describe what has been done to check that the name of the project is suitable
and if the project has legal permission to continuing using its current name.
Also indicate if the the wide use of the name likely to cause confusion about
who owns the project or banding issues in the future.

PouchDB:
PouchDB is a tongue-in-cheek pun on its sister project CouchDB. The current
holder of the project domain (pouchdb.com) and previous project lead Dale
Harvey is on board with transferring any naming rights to the ASF.

#### Orphaned Products

A public commitment to future development.

Recruiting a diverse development community and a strong user base takes time.
Apache needs to be confident that the proposers are committed.

Example (Yoko):
> The contributors are leading vendors in this space. There is no risk of any of
the usual warning signs of orphaned or abandoned code.

Example (Ivy):
> Due to its small number of committers, there is a risk of being orphaned. The
main knowledge of the codebase is still mainly owned by Xavier Hanin. Even if
Xavier has no plan to leave Ivy development, this is a problem we are aware of
and know that need to be worked on so that the project become less dependent on
an individual.

Example (Tika):
> There are a number of projects at various stages of maturity that implement a
subset of the proposed features in Tika. For many potential users the existing
tools are already enough, which reduces the demand for a more generic toolkit.
This can also be seen in the slow progress of this proposal over the past year.

> However, once the project gets started we can quickly reach the feature level
of existing tools based on seed code from sources mentioned below. After that we
believe to be able to quickly grow the developer and user communities based on
the benefits of a generic toolkit over custom alternatives.

PouchDB:
The current PouchDB maintainers already consist of representatives from various
distinct organisations with strong technical and financial incentives. It is
unlikely that a significant number would up and leave the project.

#### Inexperience with Open Source:

If the proposal is based on an existing open source project with a history of
open development, then highlight this here.

If the list of initial committers contains developers with strong open source
backgrounds, then highlight this here.

Inexperience with open source is one reason why closed projects choose to apply
for incubation. Apache has developed over the years a store of experience in
this area. Successfully opening up a closed project means an investment of
energy by all involved. It requires a willingness to learn and to give back to
the community. If the proposal is based around a closed project and comes with
very little understanding of the open source space, then acknowledge this and
demonstrate a willingness to learn.

Example (Cayenne):
> Cayenne was started as an open source project in 2001 and has remained so for
5 years.

Example (Beehive):
> Many of the committers have experience working on open source projects. Five
of them have experience as committers on other Apache projects.

Example (Ivy):
> While distributed under an open source license, access to Ivy was initially
limited with no public access to the issue tracking system or svn repository.
While things have changed since then - the svn repository is publicly
accessible, a JIRA instance has been setup since june 2005, many new features
are first discussed on the forum or JIRA - experience with a true open source
development model is currently limited.
> However, Maarten has already a good experience with true open development
process, and bring his experience to the project.

Example
(River):
> The initial committers have varying degrees of experience with open source
projects. All have been involved with source code that has been released under
an open source license, but there is limited experience developing code with an
open source development process. We do not, however, expect any difficulty in
executing under normal meritocracy rules.

PouchDB:
PouchDB is an existing open source project and its maintainers consist mostly of
very experienced developers, including some with over 15 years in active open
souce development and one ASF Member and committer since 2008. For other
maintainers, PouchDB was their first open source projects and they have since
contributed to varoious other projects as well based on their good experience
with PouchDB.

#### Length of Incubation:

Commentary:
This section describes how long the project is expected to be in incubation
before it's graduation as a top level project and the reasons for that.

This shows the project has thought about the steps required to graduate and that
there are not any unrealistic expectations.

PouchDB:
The project aims to graduate within 6–12 months based on the experience of the
Apache CouchDB incubation in 2008 and general maturity of the project itself.

#### Homogenous Developers:

Healthy projects need a mix of developers. Open development requires a
commitment to encouraging a diverse mixture. This includes the art of working as
part of a geographically scattered group in a distributed environment.

Starting with a homogenous community does not prevent a project from entering
incubation. But for those projects, a commitment to creating a diverse mix of
developers is useful. Those projects who already have a mix should take this
chance to highlight that they do.

Example (Beehive):
> The current list of committers includes developers from several different
companies plus many independent volunteers. The committers are geographically
distributed across the U.S., Europe, and Asia. They are experienced with working
in a distributed environment.

Example (River)
> Since the Jini Technology Starter Kit has been mainly developed to date by Sun
Microsystems, the vast majority of initial committers to the project are from
Sun. Over the years, Sun has received bug fixes and enhancements from other
developers which have been incorporated into the code. Our plan is to work with
these other developers and add them as committers as we progress.

> There are
three other initial committers (non-Sun): Bill Venners, Dan Creswell, and Mark
Brouwer.

> Bill is the lead of the Service UI API work, Dan has been involved
with much Jini-based development, including an implementation of the JavaSpaces
service called Blitz <http://www.dancres.org/blitz/>, and Mark is veteran of
much Jini-based development, including commercial work at Virgil
<http://www.virgil.nl> as well as leading the open source Cheiron
<http://www.cheiron.org> project.

Example (Ivy):
> With only two core developers, at least they are not homogenous! Xavier and
Maarten knew each other only due to their common interest in Ivy.

PouchDB:
The current PouchDB maintainers consist of people from around the world,
collaborating across all timezones.


#### Reliance on Salaried Developers:

A project dominated by salaried developers who are interested in the code only
whilst they are employed to do so risks its long term health.

Apache is about people, not corporations. We hope that developers continue to be
involved with Apache no matter who their current employer happens to be.

This is the right place to indicate the initial balance between salaried
developers and volunteers. It's also good to talk about the level of commitment
of the developers.

Example (OpenJPA):
> Most of the developers are paid by their employer to contribute to this
project, but given the anticipation from the Java community for the a JPA
implementation and the committers' sense of ownership for the code, the project
would continue without issue if no salaried developers contributed to the
project.

Example (River):
> It is expected that Jini development will occur on both salaried time and on
volunteer time, after hours. While there is reliance on salaried developers
(currently from Sun, but it's expected that other company's salaried developers
will also be involved), the Jini Community is very active and things should
balance out fairly quickly. In the meantime, Sun will support the project in the
future by dedicating 'work time' to Jini, so that there is a smooth transition.

Example (Wicket):
> None of the developers rely on Wicket for consulting work, though two -
Martijn and Eelco - are writing Wicket In Action (publisher Manning) in their
spare time. Most of the developers use Wicket for their day jobs, some for
multiple projects, and will do so for a considerable while as their companies
(specifically Topicus, Cemron and Teachscape) choose Wicket as their development
framework of choice.

PouchDB:
There is also a healthy mix of maintainers some of which are paid to work on
PouchDB part time, but everyone also contributes in their spare time.

#### Relationships with Other Apache Products:

Apache projects should be open to collaboration with other open source projects
both within Apache and without. Candidates should be willing to reach outside
their own little bubbles.

This is an opportunity to talk about existing links. It is also the right place
to talk about potential future links and plans.

Apache allows different projects to have competing or overlapping goals.
However, this should mean friendly competition between codebases and cordial
cooperation between communities.

It is not always obvious whether a candidate is a direct competitor to an
existing project, an indirect competitor (same problem space, different
ecological niche) or are just peers with some overlap. In the case of indirect
competition, it is important that the abstract describes the niche accurately.
Direct competitors should expect to be asked to summarize architectural
differences and similarities to existing projects.

Example (OpenJPA):
> Open JPA will likely be used by Geronimo, requires some Apache products
(regexp, commons collections, commons lang, commons pool), and supports Apache
commons logging.

Example (River)
> Currently the only tie to Apache projects is the starter kit's use of the Ant
build tool. There are potential future ties (http server, database backend, etc)
that will be explored.

PouchDB:
PouchDB has been developerd as a sister-project to Apache CouchDB. Both projects
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

#### A Excessive Fascination with the Apache Brand:

Concerns have been raised in the past that some projects appear to have been
proposed just to generate positive publicity for the proposers. This is the
right place to convince everyone that is not the case.

This is also the right place to build bridges with the community after past
misdemeanors (for example, if any of those associated with the proposal have -
in the past - sought to associate themselves with the Apache brand in factually
incorrect ways) and promise good conduct for the future.

Example (CeltiXfire):
> While we expect the Apache brand may help attract more contributors, our
interests in starting this project is based on the factors mentioned in the
Rationale section. However, we will be sensitive to inadvertent abuse of the
Apache brand and will work with the Incubator PMC and the PRC to ensure the
brand policies are respected.

Example (Wicket):
> The ASF has a strong brand, and that brand is in itself attractive. However,
the developers of Wicket have been quite successful on their own and could
continue on that path with no problems at all. We are interested in joining the
ASF in order to increase our contacts and visibility in the open source world.
Furthermore, we have been enthusiastic users of Apache from the earliest hour
(remember JServ anyone?), and feel honored at getting the opportunity to join
the club.

Example (OpenJPA):
> We think that Open JPA is something that will benefit from wide collaboration,
being able to build a community of developers and committers that outlive the
founders, and that will be embraced by other Apache efforts, such as the
Geronimo project.

PouchDB:
As mentioned before, PouchDB is looking for an open source foundation that helps
with long-term project stability and dependability. Both the OpenJS Foundation
and the ASF have been evaluated. In the end, the PouchDB developers prefer the
close proximity to Apache CouchDB. The maintainers believe that people having
to make decision about whether to bet on a PouchDB/CouchDB development stack or
not will have an easier time integrating both projects from a single foundation.
If the ASF won’t have PouchDB, we are happy to reconsider alternatives.

### Documentation

References to further reading material.

Examples (Heraldry):
> - Information on Yadis can be found at:
> http://yadis.org
> http://www.openidenabled.com
> - Information on OpenID can be found at:
> http://www.openid.net
> http://www.openidenabled.com
> The mailing list for both OpenID and Yadis is located at:
> http://lists.danga.com/mailman/listinfo/yadis

PouchDB:
Project website: https://pouchdb.com/
Including blog with release announcements: https://pouchdb.com/blog
GitHub Project: https://github.com/pouchdb/pouchdb

### Initial Source

Describes the origin of the proposed code base. If the initial code arrives from
more than one source, this is the right place to outline the different
histories.

If there is no initial source, note that here.

Example (Heraldry):
> OpenID has been in development since the summer of 2005. It currently has an
active community (over 15 million enabled accounts) and libraries in a variety
of languages. Additionally, it is supported by LiveJournal.com and is continuing
to gain traction in the Open Source Community.
> Yadis has been in development since late 2005, and the specification has not
changed since early 2006. Like OpenID, it has libraries in various languages,
and there is a large overlap between the two communities.

PouchDB:
The initial source tree lives at https://github.com/pouchdb/pouchdb

### Source and Intellectual Property Submission Plan

Complex proposals (typically involving multiple code bases) may find it useful
to draw up an initial plan for the submission of the code here. Demonstrate that
the proposal is practical.

Example (Heraldry):
> * The OpenID specification and content on openid.net from Brad Fitzpatrick of
Six Apart, Ltd. and David Recordon of VeriSign, Inc.
> * The domains openid.net and yadis.org from Brad Fitzpatrick of Six Apart,
Ltd. and Johannes Ernst of NetMesh, Inc.
> * OpenID libraries in Python, Ruby, Perl, PHP, and C# from JanRain, Inc.
> * Yadis conformance test suite from NetMesh and VeriSign, Inc.
>
> We will also be soliciting contributions of further plugins and patches to
various pieces of Open Source software.

PouchDB:
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

#### External Dependencies:

External dependencies for the initial source is important. Only some external
dependencies are allowed by Apache policy. These restrictions are (to some
extent) initially relaxed for projects under incubation.

If the initial source has dependencies which would prevent graduation, then this
is the right place to indicate how these issues will be resolved.

Example (CeltiXfire):
> The dependencies all have Apache compatible licenses. These include BSD, CDDL,
CPL, MPL and MIT licensed dependencies.

PouchDB:
PouchDB depends directly on the following other projects. An automated licensing
scan has revealed the following set of licenses in the dependency tree:

Runtime dependencies: three dependencies with to-be-sorted-out licenses:
- argsarray (WTFPL), trivially replaced with a compatible version.
- fetch-cookie (Unlicense, public-domain), could be fine, but check with ASF.
- readable-stream (incorrectly labelled BSD license), newer versions are MIT
  licensed, we should upgrade.

Development dependencies: if applicable, we’ll need to go through those and see
what can be done about them:

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

With the following licenses being permitted:

- Apache-2.0
- MIT
- BSD-2-Clause
- BSD-3-Clause
- ISC
- BSD

#### Cryptography:

If the proposal involves cryptographic code either directly or indirectly,
Apache needs to know so that the relevant paperwork can be obtained.

PouchDB:
PouchDB does not directly include cryptography code, but makes use of in-browser
TLS. A PouchDB plugin crypto-pouch exists that does record-level encryption, but
it is currently not part of the PouchDB code base. If md5 hashing is considered
cryptography, PouchDB, like CouchDB, makes use of that (md5 hashing is not used
for security relevant operations).

### Required Resources

#### Mailing lists:

The minimum required lists are private@{podling}.incubator.apache.org (for
confidential PPMC discussions) and dev@{podling}.incubator.apache.org lists.
Note that projects historically misnamed the private list PMC. To avoid
confusion over appropriate usage, it was resolved that all such lists be
renamed.

If this project is new to open source, then starting with these minimum lists is
the best approach. The initial focus needs to be on recruiting new developers.
Early adopters are potential developers. As momentum is gained, the community
may decide to create commit and user lists as they become necessary.

Existing open source projects moving to Apache will probably want to adopt the
same mailing list set up here as they have already. However, there is no
necessity that all mailing lists be created during bootstrapping. New mailing
lists can be added by a VOTE on the Podling list.

By default, commits for {podling} will be emailed to
commits@{podling}.incubator.apache.org. It is therefore recommended that this
naming convention is adopted.

Mailing list options are described at greater length elsewhere.

Example (Beehive):
> * private@beehive.incubator.apache.org (with moderated subscriptions)
> * dev@beehive.incubator.apache.org
> * commits@beehive.incubator.apache.org

PouchDB:
* dev@pouchdb.incubator.apache.org
* private@pouchdb.incubator.apache.org
* commits@pouchdb.incubator.apache.org

#### Subversion Directory:

It is conventional to use all lower case, dash-separated (-) directory names.
The directory should be within the incubator directory space
(http://svn.apache.org/repos/asf/incubator).

Example (OpenJPA):
> https://svn.apache.org/repos/asf/incubator/openjpa

PouchDB:
n/a

#### Git Repositories:
It is conventional to use all lower case, dash-separated (-) repository names.
The repository should be prefixed with incubator and later renamed assuming the
project is promoted to a TLP.

Example (Batchee):
> https://gitbox.apache.org/repos/asf/incubator-batchee.git

PouchDB:
* https://gitbox.apache.org/repos/asf/incubator-pouchdb.git
* https://github.com/apache/incubator-pouchdb.git

#### Issue Tracking:

Apache runs JIRA and Bugzilla. Choose one. Indicate the name by which project
should be known in the issue tracking system.

Example (OpenJPA):
> JIRA Open-JPA (OPEN-JPA)

PouchDB:
GitHub Issues

#### Other Resources:

Describe here any other special infrastructure requirements necessary for the
proposal. Note that the infrastructure team usually requires a compelling
argument before new services are allowed on core hardware. Most proposals should
not require this section.

Most standard resources not covered above (such as continuous integration)
should be added after bootstrapping. The infrastructure documentation explains
the process.

PouchDB:
PouchDB makes significant use of GitHub Actions for CI. For 2024, we have used
214,556 total minutes across 53,831 job runs. This can be migrated if need be
but it’d be great if this carefully crafted setup could remain in place.

### Initial Committers

List of committers (stating name and an email address) used to bootstrap the
community. Mark each which has submitted a contributor license agreement (CLA).
Existing committers should use their apache.org email address (since they
require only appropriate karma). Others should use the email address that is (or
will be) on the CLA. That makes it easy to match CLAs with proposed committers
to the project.

It is a good idea to submit CLAs at the same time as the proposal. Nothing is
lost by having a CLA on file at Apache but processing may take some time.

Note this and this. Consider creating a separate section where interested
developers can express an interest (and possibly leave a brief introduction) or
ask them to post to the general list.

Example (OpenJPA):
> Abe White (awhite at bea dot com)
> Marc Prud'hommeaux (mprudhom at bea dot com)
> Patrick Linskey (plinskey at bea dot com)
> ...
> Geir Magnusson Jr (geirm at apache dot org) *
> Craig Russell (clr at apache dot org) *

PouchDB:

Alba Herrerías Ramírez albaherreriasdev at gmail dot com
Alex Anderson asf-pouchdb at alxndrsn dot com
Diana Thayer garbados at apache dot org (CLA)
Diana Barsan twisteddiana at gmail dot com
Gareth Bowen gareth at bowenwebdesign dot co dot nz
Jan Lehnardt jan at apache dot org (CLA)
James Coglan james at neighbourhood dot ie
Johannes Schmidt schmidt at tf-fabrik dot de
Steven-John Lange sourcer85 at gmail dot com


### Sponsors

A little bit of a controversial subject. Committers at Apache are individuals
and work here on their own behalf. They are judged on their merits, not their
affiliations. However, in the spirit of full disclosure, it is useful for any
current affiliations which may affect the perceived independence of the initial
committers to be listed openly at the start.

For example, those in salaried positions whose job is to work on the project
should list their affiliation. Having this list helps to judge how much
diversity exists in the initial list and so how much work there is to do.

This is best done in a separate section away from the committers list.

Only the affiliations of committers on the initial bootstrap list are relevant.
These committers have not been added by the usual meritocratic process. It is
strongly recommended that once a project is bootstrapped, developers are judged
by their contributions and not by their background. This list should not be
maintained after the bootstrap has been completed.

PouchDB:
Alba Herrerías Ramírez Neighbourhoodie
Alex Anderson independent, formerly Medic
Diana Thayer independent
Diana Barsan Medic
Gareth Bowen independent, formerly Medic
Jan Lehnardt Neighbourhoodie
James Coglan Neighbourhoodie
Johannes Schmidt Mozilla / independent
Steven-John Lange HZData GmbH / independent

#### Champion:
The Champion is a person already associated with Apache who leads the proposal
process. It is common - but not necessary - for the Champion to also be proposed
as a Mentor.

A Champion should be found while the proposal is still being formulated. Their
role is to help formulate the proposal and work with you to resolve comments and
questions put forth by the IPMC while reviewing the proposal.

PouchDB:
Jan Lehnardt, CouchDB PMC Chair.

#### Nominated Mentors:

Lists eligible (and willing) individuals nominated as Mentors [definition] for
the candidate.

Three Mentors gives a quorum and allows a Podling more autonomy from the
Incubator PMC, so the current consensus is that three Mentors is a good number.
Any experienced Apache community member can provide informal mentorship anyway,
what's important is to make sure the podling has enough regularly available
mentors to progress smoothly. There is no restriction on the number of mentors,
formal or informal that a Podling may have.

PouchDB:
PJ Fanning (fanningpj at apache dot org)
Jean-Baptiste Onofré (jb at nanthrax dot net)

#### Sponsoring Entity:
The Sponsor is the organizational unit within Apache taking responsibility for
this proposal. The sponsoring entity can be:

 - The Apache Board
 - The Incubator
 - Another Apache project

The PMC for the appropriate project will decide whether to sponsor (by a vote).
Unless there are strong links to an existing Apache project, it is recommended
that the proposal asks that the Incubator for sponsorship.

Note that the final destination within the Apache organizational structure will
be decided upon graduation.

PouchDB:
The Incubator
