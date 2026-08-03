# Changelog

## [0.4.2](https://github.com/bbaldino/family-dashboard/compare/v0.4.1...v0.4.2) (2026-08-03)


### Bug Fixes

* **themes/broadsheet:** stop the sports column narrating its own layout ([7151946](https://github.com/bbaldino/family-dashboard/commit/71519468cbba01780f2011b0963dc39632b8beac))

## [0.4.1](https://github.com/bbaldino/family-dashboard/compare/v0.4.0...v0.4.1) (2026-08-03)


### Bug Fixes

* **themes/broadsheet:** show six chores per person ([60d0d27](https://github.com/bbaldino/family-dashboard/commit/60d0d271a2eecb36f912dcf1e6155e8299ecb9d3))

## [0.4.0](https://github.com/bbaldino/family-dashboard/compare/v0.3.0...v0.4.0) (2026-08-03)


### Features

* **themes/broadsheet:** give the household column the room it needed ([7fc5f24](https://github.com/bbaldino/family-dashboard/commit/7fc5f242667121859e81cc6727a69c1020514160))
* **themes/broadsheet:** put a way into settings in the footer ([1954b9c](https://github.com/bbaldino/family-dashboard/commit/1954b9c7f1b51e778a04cf8d82703723b5c17d3d))

## [0.3.0](https://github.com/bbaldino/family-dashboard/compare/v0.2.0...v0.3.0) (2026-08-03)


### Features

* **data/doorbell:** theme the embedded doorbell page over postMessage ([f8dd910](https://github.com/bbaldino/family-dashboard/commit/f8dd910040e730b28f4e7abf3cab3e956c0f0375))
* **themes/broadsheet:** add cameras screen, the Watch Room ([fbba6d0](https://github.com/bbaldino/family-dashboard/commit/fbba6d0a0a1a4b836fbf8b04e2feeba8a383ed59))
* **themes/broadsheet:** add The Wire, the service health board ([de8657e](https://github.com/bbaldino/family-dashboard/commit/de8657e5f3f908e0e47b5a903eadd6f12a21172e))
* **themes/broadsheet:** announce a doorbell press as a stop-press slip ([1779bbd](https://github.com/bbaldino/family-dashboard/commit/1779bbd6cac90fb41a76826f1756f17bb957549c))
* **themes/broadsheet:** dress the Watch Room's camera feed ([123844f](https://github.com/bbaldino/family-dashboard/commit/123844f570fcc8b0513a89d1a6b7c2f47160d753))


### Bug Fixes

* **app:** decide HA availability over the websocket, not a CORS-blocked fetch ([d36ae2c](https://github.com/bbaldino/family-dashboard/commit/d36ae2c574fbab472664e3fb94518f725cd5a442))
* **hooks:** return null for a missing entity instead of throwing ([3320e76](https://github.com/bbaldino/family-dashboard/commit/3320e762fdea074441e0bc56a5f8fc6f7ded3bef))

## [0.2.0](https://github.com/bbaldino/family-dashboard/compare/v0.1.0...v0.2.0) (2026-08-03)


### Features

* **admin:** settings-registry decouples settings from data-layer integration defs ([24d6668](https://github.com/bbaldino/family-dashboard/commit/24d666826f04ad445d0e317926add55d618a72bb))
* **admin:** theme picker writes theme.presentation ([8cced43](https://github.com/bbaldino/family-dashboard/commit/8cced43e3d46761c2926a0bc6245463a1a7bb558))
* **backend/music:** carry album label/description, artist genres/description, and full track artist list ([e5d6e8f](https://github.com/bbaldino/family-dashboard/commit/e5d6e8f1f01cd6703891bd79104afa40cf7b238b))
* **backend/music:** carry year, label, track number, and source through to TrackInfo ([d205ba2](https://github.com/bbaldino/family-dashboard/commit/d205ba23afb10ba96d21b92078c1be2de17eff6d))
* **backend/weather:** pass through sunrise/sunset, add Open-Meteo air quality ([5abf280](https://github.com/bbaldino/family-dashboard/commit/5abf280c9571e7af80f702e64271c4bab6074b40))
* **data/music:** widen album/artist detail types for label, description, genres, and featured artists ([8f91d9a](https://github.com/bbaldino/family-dashboard/commit/8f91d9a468c5fda4f6356076c6a958a6b54c400a))
* **data:** add ?scenario= fixtures for the calendar hooks ([9cdc3ec](https://github.com/bbaldino/family-dashboard/commit/9cdc3ecd2542b4486f837093bff52209a2f5d540))
* **data:** add ?scenario= fixtures for the music hooks ([2ddc594](https://github.com/bbaldino/family-dashboard/commit/2ddc5942b0e2c7e10eb6ed946a93ed12b01830e6))
* **frontend/data/music:** widen TrackInfo and QueueItem for the backend's new fields ([a1cd697](https://github.com/bbaldino/family-dashboard/commit/a1cd697c1b36ecf7dac8b1d4b7ba3724bfdfa7cd))
* **shell:** error boundaries and shell-owned fallback screens ([1b416af](https://github.com/bbaldino/family-dashboard/commit/1b416af4c898fbece85a424adeeeb8242971003c))
* **shell:** route the dashboard through ThemeMount ([016d17b](https://github.com/bbaldino/family-dashboard/commit/016d17bc633e81747f11b455d04bf3e849727c99))
* **shell:** ScreenShell scales a fixed-canvas theme to the viewport ([22bc19d](https://github.com/bbaldino/family-dashboard/commit/22bc19d70c7e979a202ba116fbf75170b07fd55b))
* **shell:** theme contract types and ScreenKey → URL path table ([4606be0](https://github.com/bbaldino/family-dashboard/commit/4606be0c3a7cd0a52edcd3f433e095658aa53fc3))
* **shell:** ThemeRegistry + ThemeMount for reading and mounting themes ([32de58a](https://github.com/bbaldino/family-dashboard/commit/32de58a1cef3c02584b661537d893281604861f3))
* **themes/broadsheet, data/music:** wire room pills as join/leave toggles ([4c1750b](https://github.com/bbaldino/family-dashboard/commit/4c1750baf9b88bc8beeb35487d28f894c485a8f6))
* **themes/broadsheet/datebook:** EventPill, DayCell, MonthGrid, masthead ([7c5b806](https://github.com/bbaldino/family-dashboard/commit/7c5b806d26a134aa915e10ad12521795670cac3c))
* **themes/broadsheet/datebook:** pure month/tally/standfirst helpers ([10ad711](https://github.com/bbaldino/family-dashboard/commit/10ad711a1773522b176655748399252a97c1a265))
* **themes/broadsheet/media:** add sourceLabel for MA provider ids ([5ae076c](https://github.com/bbaldino/family-dashboard/commit/5ae076c0bbd71d107908cbd03d75f6f187ba7a5f))
* **themes/broadsheet/media:** add the Centre Spread full-page now-playing view ([82fc500](https://github.com/bbaldino/family-dashboard/commit/82fc500f8769b7b8de8e3cc8a48dcea0070537f8))
* **themes/broadsheet/media:** cover art with a deterministic gradient fallback ([7858554](https://github.com/bbaldino/family-dashboard/commit/785855400c3bbee8652219f829734827a97aecd9))
* **themes/broadsheet/media:** make the Now Spinning cover tappable ([ce39f89](https://github.com/bbaldino/family-dashboard/commit/ce39f89eea2a857e13804f99a858480092ce78ee))
* **themes/broadsheet/media:** masthead and the Now Spinning transport rail ([0303153](https://github.com/bbaldino/family-dashboard/commit/03031532d0dd70dd0b4bd35eb04b9e06940d5aa0))
* **themes/broadsheet/media:** Quick Dials, For You, and search-results panels ([59fbfb4](https://github.com/bbaldino/family-dashboard/commit/59fbfb4c995fe031f77f8ccb28a3a596b22fc0e2))
* **themes/broadsheet/media:** shelf card grid, capped by measured row height ([d6d2461](https://github.com/bbaldino/family-dashboard/commit/d6d2461178b31db16f800996751d76c11b346604))
* **themes/broadsheet/ui:** let MastheadFrame's padding be overridden ([e203df3](https://github.com/bbaldino/family-dashboard/commit/e203df38a0417fd40ebcfd532b6da5b992855cd4))
* **themes/broadsheet:** assemble Home with layout and footer nav ([0844c52](https://github.com/bbaldino/family-dashboard/commit/0844c5215f7aaa4ccc780951b40e57bbfe7daf1d))
* **themes/broadsheet:** build the weather strip above the footer ([0bbe54f](https://github.com/bbaldino/family-dashboard/commit/0bbe54f36e0075bfb207eb626e4677d602fd181f))
* **themes/broadsheet:** editorial atoms — kicker, rules, team cap ([1b17e73](https://github.com/bbaldino/family-dashboard/commit/1b17e7339db9a77a78792b16769a85ae75b3a431))
* **themes/broadsheet:** editorial track actions menu ([8316339](https://github.com/bbaldino/family-dashboard/commit/831633951f84c29eeb4e89bc932ddddbe7f130a2))
* **themes/broadsheet:** editorial type and colour tokens ([cde7089](https://github.com/bbaldino/family-dashboard/commit/cde7089f444074994df13ab0893f0b7b941df1bc))
* **themes/broadsheet:** glance strip ([ce68537](https://github.com/bbaldino/family-dashboard/commit/ce685378abc7035c66c99a5db6b7170c198085c4))
* **themes/broadsheet:** group chores by person in the household column ([a76751c](https://github.com/bbaldino/family-dashboard/commit/a76751c430afcd58685cf623ecb7b4eb156e7f43))
* **themes/broadsheet:** HouseholdColumn matches the mock section-by-section ([6e44f86](https://github.com/bbaldino/family-dashboard/commit/6e44f86dbfa5f4c1e6635ee332932706f7345a22))
* **themes/broadsheet:** masthead with date, title, and weather ([2ea9c9c](https://github.com/bbaldino/family-dashboard/commit/2ea9c9cafeb5c727be0bee95575c7eb7e3c9dc7b))
* **themes/broadsheet:** register a Home-only broadsheet theme ([fa2bff6](https://github.com/bbaldino/family-dashboard/commit/fa2bff666e94e66cb71cc1e5e1f2d275f531fb2c))
* **themes/broadsheet:** register Media — The Listening Room ([58df0bc](https://github.com/bbaldino/family-dashboard/commit/58df0bc5d0ab5d5b525aa0e0d61b9ebdbc8a2503))
* **themes/broadsheet:** register the Datebook as the calendar screen ([680e296](https://github.com/bbaldino/family-dashboard/commit/680e296363b3de0b3b10527a530fc9cb6292b3fe))
* **themes/broadsheet:** schedule column ([b8140f8](https://github.com/bbaldino/family-dashboard/commit/b8140f8cba784197ad2951de292cdd3ed2cccf8a))
* **themes/broadsheet:** ScheduleColumn splits into Today hero + week ahead ([725b788](https://github.com/bbaldino/family-dashboard/commit/725b78820c8704cb35ec90e3311e6386929d8dc6))
* **themes/broadsheet:** sports column with live takeover ([5b74184](https://github.com/bbaldino/family-dashboard/commit/5b74184508f4d354bafe02994ec01e55b3b3c901))
* **themes/broadsheet:** standfirst prose generator ([3546f0f](https://github.com/bbaldino/family-dashboard/commit/3546f0f8d7db95ac0c8018e9d663c9442423a340))
* **themes/broadsheet:** The Profile — artist view pieces ([7426b03](https://github.com/bbaldino/family-dashboard/commit/7426b030edd0b8272bda179e243d3a817fea34f9))
* **themes/broadsheet:** The Record — album view pieces ([e6f2ac9](https://github.com/bbaldino/family-dashboard/commit/e6f2ac939d1e488fcdeb54b26edec1448added23))
* **themes/broadsheet:** wire The Record and The Profile into Media ([e28956a](https://github.com/bbaldino/family-dashboard/commit/e28956a6bc6b3b66e92e34c89fdd014fac3b3518))
* **themes/broadsheet:** wire the track actions menu into the Listening Room ([65e64f1](https://github.com/bbaldino/family-dashboard/commit/65e64f196490c3b7d18010cc0e2efe5ed23ded83))
* **themes/grid:** register the grid theme pointing at existing screens ([a3b1ec9](https://github.com/bbaldino/family-dashboard/commit/a3b1ec90f2ee28f53fcf5667526dbc640803726d))


### Bug Fixes

* **admin/theme:** handle ThemePicker save failures ([5fe90af](https://github.com/bbaldino/family-dashboard/commit/5fe90af04c262ed46b0627edbc9a69ac25164458))
* **backend/music:** make album/artist metadata enrichment best-effort ([a2cda42](https://github.com/bbaldino/family-dashboard/commit/a2cda42fc051cfde4d7304d524923b585f28eb9b))
* **backend/music:** resolve artist/album URIs on explicit plays missing them ([c66c35a](https://github.com/bbaldino/family-dashboard/commit/c66c35ae52fada6906e774c498b92d1e7d7ef891))
* **data,themes/grid:** commit missing weather+plan import fixes ([b41a855](https://github.com/bbaldino/family-dashboard/commit/b41a8556ac427e2c25951be8fa82712219ab7005))
* **data/music, themes/broadsheet, themes/grid:** make group/ungroup actually optimistic ([aedc0c8](https://github.com/bbaldino/family-dashboard/commit/aedc0c8d42b68e66a5d075e5d66e222412c913fe))
* **data/music, themes/broadsheet:** surface a failed transport action ([2139740](https://github.com/bbaldino/family-dashboard/commit/21397409d47b3e9d264b9cd1f88d6144b4094155))
* **data/music:** don't confirmation-poll a group-volume change ([af6365d](https://github.com/bbaldino/family-dashboard/commit/af6365d92c71437d79e00bef0877a1cffbb9dd99))
* **data/music:** hold the room list steady across a grouping transition ([6185a53](https://github.com/bbaldino/family-dashboard/commit/6185a53dcd21370fa8efff675a8f22668d1aaf4f))
* **data/music:** resolve the room-pill anchor from the fixture under a scenario ([ba8ddd0](https://github.com/bbaldino/family-dashboard/commit/ba8ddd09c0ea0fb147c7db2c2ad699bafed04924))
* **data/music:** widen the convergence bound past MA's observed worst case ([5f30369](https://github.com/bbaldino/family-dashboard/commit/5f303690b010b1661209fa8d1c2cc2ee1057dba0))
* **integrations/registry:** use timers barrel for timersIntegration import ([001d22d](https://github.com/bbaldino/family-dashboard/commit/001d22d8dea5bdd9fcc937c0f33fa1a9080ade64))
* **lint:** clear the lint debt surfaced by the first full lint run ([d6707ba](https://github.com/bbaldino/family-dashboard/commit/d6707ba4ba811f9a65881510ca7bf7b97e81d16d))
* **music:** fall back to a plain play when radio mode fails ([c55c46e](https://github.com/bbaldino/family-dashboard/commit/c55c46e7e551dd25d04dd78cf6bdcfcb279c06eb))
* **shell:** per-ScreenKey fallback routing + rename ThemeApplicator ([ae5af3e](https://github.com/bbaldino/family-dashboard/commit/ae5af3e0b1eb130835566b2f51740b3f7d4cfdec))
* **test:** inline @hakit/core in vitest to unblock direct DoorbellRingListener import ([8dfde5b](https://github.com/bbaldino/family-dashboard/commit/8dfde5b8ecf249c37b3a13db0f07850cea144a18))
* **themes/broadsheet:** cap LiveGame's leader and play lists to their box ([75b8e5e](https://github.com/bbaldino/family-dashboard/commit/75b8e5ec0c3d0e9003edfa34942f560ca847e23d))
* **themes/broadsheet:** cap the today hero so it can't push the week off ([170d2d9](https://github.com/bbaldino/family-dashboard/commit/170d2d9bfc6868fedec40591c56928352f555c0a))
* **themes/broadsheet:** clamp on-this-day to the room the column has ([8523c0c](https://github.com/bbaldino/family-dashboard/commit/8523c0c05b9f2c1ad0f713c41af440e1552f64e7))
* **themes/broadsheet:** clip the Home body row and budget schedule days ([e9cb4ca](https://github.com/bbaldino/family-dashboard/commit/e9cb4ca051dc9646cb79f0460380e70dde981767))
* **themes/broadsheet:** compact inning labels and complementary win-prob ([c1047a3](https://github.com/bbaldino/family-dashboard/commit/c1047a3950007605e43bc0bcdad777e32d90df8e))
* **themes/broadsheet:** give the on-this-day blurb its own line, full width ([c73944b](https://github.com/bbaldino/family-dashboard/commit/c73944bff2b62740e31f86817b6c6756bacafe3f))
* **themes/broadsheet:** give the volume slider a real tap target ([87eab7a](https://github.com/bbaldino/family-dashboard/commit/87eab7ae6bb92d28d1281162c61de785ad42cf30))
* **themes/broadsheet:** guard unbounded weather reads in Masthead ([6c2cfb9](https://github.com/bbaldino/family-dashboard/commit/6c2cfb90aae9820ca3cfe2cbb567ead6aa5a8fe1))
* **themes/broadsheet:** keep a room pill's height steady as it toggles ([4e75b88](https://github.com/bbaldino/family-dashboard/commit/4e75b889ab8561f19b3f1ab6e745994b728ae9ce))
* **themes/broadsheet:** Kicker atom matches the mock's bold-rust byline ([4ba1977](https://github.com/bbaldino/family-dashboard/commit/4ba1977f104fbb9811fdc3935041f5719f68095a))
* **themes/broadsheet:** make progress and volume bars show a real level ([fd33319](https://github.com/bbaldino/family-dashboard/commit/fd3331914f8bf7863aa684df9977ec6af1190666))
* **themes/broadsheet:** masthead matches the mock — date replaces wordmark ([c7d4c11](https://github.com/bbaldino/family-dashboard/commit/c7d4c118d635e3ecd4a5ea253009d20a512b271d))
* **themes/broadsheet:** mount MusicProvider in BroadsheetLayout ([3e044d2](https://github.com/bbaldino/family-dashboard/commit/3e044d2b5819ad3e47b42ac9d407700ad037b879))
* **themes/broadsheet:** move GlanceStrip's minWidth to the flex child ([b99f989](https://github.com/bbaldino/family-dashboard/commit/b99f9897b06105a48291fbfa5f3bc0cd0098010a))
* **themes/broadsheet:** name what each chore overflow line hides ([5bf2301](https://github.com/bbaldino/family-dashboard/commit/5bf23011d2264cf87c8341a740a91482969ec08e))
* **themes/broadsheet:** on-this-day blurb to 15px ([f1fbc2a](https://github.com/bbaldino/family-dashboard/commit/f1fbc2ac782bed23d933bc6ff10e80f891bf49f2))
* **themes/broadsheet:** one full-bleed rule between strip and footer ([b1a403f](https://github.com/bbaldino/family-dashboard/commit/b1a403f6cbd7909340f86637e9e5d23579a16658))
* **themes/broadsheet:** open one sports SSE connection, not three ([77d31a4](https://github.com/bbaldino/family-dashboard/commit/77d31a4aafa5c9654abfe1b32c496d46bce19b03))
* **themes/broadsheet:** pin WeatherStrip's flex-shrink so only the body clips ([698df9c](https://github.com/bbaldino/family-dashboard/commit/698df9c1166ae8d78053e5c5c97e31ce9af6f53e))
* **themes/broadsheet:** remove the masthead's weather kicker entirely ([3ddfb8a](https://github.com/bbaldino/family-dashboard/commit/3ddfb8a676b1e65f296269bc925d8192f9f997ec))
* **themes/broadsheet:** restore Home's three-column body and live reflow ([d45d182](https://github.com/bbaldino/family-dashboard/commit/d45d1822d4b3b098bbde72de35fba8a4ab7c8da1))
* **themes/broadsheet:** scope a shelf card's menu id to its shelf ([fe7d3e1](https://github.com/bbaldino/family-dashboard/commit/fe7d3e179dcd6a20be2e3f55cf21c4d46b7c1695))
* **themes/broadsheet:** show the actual volume level on the volume bar ([b983768](https://github.com/bbaldino/family-dashboard/commit/b98376898ae87baf864fdb09c409569e512b4c9e))
* **themes/broadsheet:** size up the on-this-day blurb ([eb090e3](https://github.com/bbaldino/family-dashboard/commit/eb090e3e23892f51d2dab8ec20e13c9aa71fbb65))
* **themes/broadsheet:** sports and footer typography touch-ups against mock ([4f4ef61](https://github.com/bbaldino/family-dashboard/commit/4f4ef61c44ed0f3d7ec749a3fb527ccfdd30fc9f))
* **themes/broadsheet:** standfirst plural agreement ([5a026d6](https://github.com/bbaldino/family-dashboard/commit/5a026d68666eac577aa7ee2ba04a6ad37053252b))
* **themes/grid:** route driving-time type imports through the barrel ([ec6740c](https://github.com/bbaldino/family-dashboard/commit/ec6740cfb1a2b8514376a828f436ac716e79bbd9))
* **themes/grid:** wire up screen import paths after Task 4 moves ([9c47e8b](https://github.com/bbaldino/family-dashboard/commit/9c47e8b6326bd089f01ac9e066e15d965fbc06da))
* **theme:** update src/main.tsx CSS import after palettes rename ([faf67f9](https://github.com/bbaldino/family-dashboard/commit/faf67f97ffa7936c64849c97d03b1ffbfa1cf8b7))
