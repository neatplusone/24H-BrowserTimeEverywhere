# BrowserTime
Extension to change from 12 hour to 24 hour format.
Text Input fields (like search engine or anywhere else) and rich text editors (contenteditable, like Discord message box) are not touched

Understands:
- `5:10 pm`, `5:10PM`, `5:10 p.m.`, `11:59:30 PM`, `8:30p`
- dots instead of colons: `05.10 pm` → `17.10`
- hours only: `8 AM - 12 PM`, `8AM`, `Reopens 3 pm`
- ranges where only the end has am/pm (Google Maps/Search): `9:30–1 pm` → `09:30–13:00`, `3–6 pm` → `15:00–18:00`

Bare `8p`/`10a` without minutes are left alone (too many false positives like "Room 8a")

Changed text is converted right before the page is drawn (no more polling every 500ms), including late-loading content on Discord, Google Maps etc.

Extension popup (toolbar icon), for "This site" or "All sites" (a site's own settings win; "Use All sites settings" resets it):
- turn it off (original text comes back)
- switch single rules off: ranges (`3–6 pm`), hour only (`8 AM`), dot separator (`8.00 am`), a/p shorthand (`8:30p`)
- output: keep the site's separator (`08.00`) or always use a colon (`08:00`)
- see what was converted on the page and by which rule (e.g. `3-5 pm` → `15:00-17:00`, range)

The userscript version has no popup and runs everywhere with everything on.

There might be some JavaScript errors thrown, might not work everywhere, but seems to work not that terribly...

 [![][greasyfork_icon]][greasyfork_url] or [GitHub](https://github.com/dw5/24H-BrowserTimeEverywhere/raw/main/12hto24h.user.js) <br>
[Firefox Extension store](https://addons.mozilla.org/en-US/firefox/addon/force-24-hour-time-12hto24h/) -OR- [Chrome webstore](https://chrome.google.com/webstore/detail/cnlcjjkpieaicobjefacmolmhlojdacl)  <BR>  
And yes from looks of it, extension release works a bit differently from greasyfork despite same exact code... like on this page https://www.mathsisfun.com/time.html ..? (violentmonkey changes am/pm time as well, but browser extension release doesn't touch it, and yes it works because this https://www.onlineconversion.com/date_12-24_hour.htm and other sites confirm it)

# Sources
Inspired on work from Greenscreener:
- https://gist.github.com/Greenscreener/4422f5be36752bc720cbc7222fb73cdc


<!-- links -->
[greasyfork_icon]: https://user-images.githubusercontent.com/3372598/166113712-1bc3d654-1342-4f1e-9845-21c3b21524b1.png
[greasyfork_url]: <https://greasyfork.org/en/scripts/466636-12-hour-am-pm-to-24-hour-format> "Get 12hto24h from GreasyFork"
