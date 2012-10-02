
0.2.5 / 2011-12-03
==================

  * Adding main job url getter to sauce client
  * Add 'selectAndWait' command
  * Do not ignore timeouts.
  * Fixed chaining to let users send further commands during chain end
  * Added support job URL generation

0.2.4 / 2011-05-27
==================

  * Added support for the `store` accessor
  * Fixed case with very long url by utilizing a urlencoded POST request [tszming]

0.2.3 / 2011-03-28 
==================

  * Added `captureNetworkTraffic`

0.2.2 / 2011-02-25 
==================

  * Use ondemand.saucelabs.com:80 by default [epall]

0.2.1 / 2011-02-03 
==================

  * Added `captureScreenshotToString` to command list

0.2.0 / 2010-10-12 
==================

  * Added `.and()` (see docs)
  * Added several commands [dshaw]
  * Fixed `selectStoreOptions` typo [dshaw]

0.1.0 / 2010-10-07 
==================

  * Added `Client#and()` to provide an arbitrary callback [suggested by dshaw / scoates]

0.0.2 / 2010-09-16 
==================

  * Added saucelabs environment variables [Adam Christian]
  * Added Adam Christian to the authors list

0.0.1 / 2010-09-16 
==================

  * Initial release
