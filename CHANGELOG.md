# Changelog

## [0.5.2](https://github.com/bbaldino/family-dashboard/compare/v0.5.1...v0.5.2) (2026-08-12)


### Bug Fixes

* **datebook:** stop banners clipping the tops of accented capitals ([1d8b42d](https://github.com/bbaldino/family-dashboard/commit/1d8b42d3ee4ce8971f26f7baf28e60ba51a0b054))

## [0.5.1](https://github.com/bbaldino/family-dashboard/compare/v0.5.0...v0.5.1) (2026-08-12)


### Bug Fixes

* **datebook:** take only byDate in computeMonthTally ([3ebd501](https://github.com/bbaldino/family-dashboard/commit/3ebd501a42654e3edd144288492ba415e17b27b9))

## [0.5.0](https://github.com/bbaldino/family-dashboard/compare/v0.4.3...v0.5.0) (2026-08-12)


### Features

* **backend/platform:** add the allowlisted fetch capability ([934583c](https://github.com/bbaldino/family-dashboard/commit/934583cd419ccea0bfdf72d3a9515847d702455b))
* **backend/platform:** declare weather's endpoints in the manifest ([d6f460d](https://github.com/bbaldino/family-dashboard/commit/d6f460d7cd4fb5287c585169f8aa56a4fd515ea7))
* **backend/platform:** let fetch carry a method, headers and a body ([8b41a53](https://github.com/bbaldino/family-dashboard/commit/8b41a53edb826d2cc4794f7f406e8315ac58c832))
* **backend/platform:** load and validate the endpoint manifest ([6d7edc5](https://github.com/bbaldino/family-dashboard/commit/6d7edc5e14fd96870fc5df0d75d13268b3c42031))
* **backend/platform:** resolve config and secrets server-side for fetch ([17e9d73](https://github.com/bbaldino/family-dashboard/commit/17e9d73b29180bf1b70d3575cd634abdaecb6a42))
* **backend:** migrate grid layout config to the theme.grid prefix ([4b256f5](https://github.com/bbaldino/family-dashboard/commit/4b256f5b769203dd30e57029c09c322be388ebb2))
* **broadsheet:** add pickPriorFinal to select the most recent final ([ca24703](https://github.com/bbaldino/family-dashboard/commit/ca24703329286e96e14a3d4a113e856526d60c7f))
* **broadsheet:** add the prior-game final report strip ([df87059](https://github.com/bbaldino/family-dashboard/commit/df87059e253a690ee58c3e67dcb624fbc447abf3))
* **calendar:** give the calendar views their own integration ([6c340c1](https://github.com/bbaldino/family-dashboard/commit/6c340c145e986e1480c6a74124a8ce49a88710a0))
* **datebook:** draw multi-day events as connected banners ([2ac6995](https://github.com/bbaldino/family-dashboard/commit/2ac6995e3e8b1085079800a0d89fa4f8d4c8140d))
* **driving-time:** migrate off the Rust backend onto fetch ([4c5b6bd](https://github.com/bbaldino/family-dashboard/commit/4c5b6bdd015a94ab36b9080730f2173880f79dfa))
* **fetch:** add expect: "text" for non-JSON upstream responses ([5156f1e](https://github.com/bbaldino/family-dashboard/commit/5156f1e0b7fee55b18b091e93fb37a8dc8893395))
* **frontend/platform:** add useIntegrationData and migrate weather onto it ([efe0225](https://github.com/bbaldino/family-dashboard/commit/efe0225dd04fbe273834cd0df366a26f277d7cf2))
* **frontend/platform:** let an integration ask for a text response ([1b6a850](https://github.com/bbaldino/family-dashboard/commit/1b6a850fba91a3d6d3c24f5451e7ab7d6a35c503))
* **frontend/weather:** migrate weather onto the fetch capability ([f3d2493](https://github.com/bbaldino/family-dashboard/commit/f3d249378d58dc2e6c3dc2bf9f19ae1c97a8efeb))
* **integrations/health:** add config schema and settings entry ([d25dfa5](https://github.com/bbaldino/family-dashboard/commit/d25dfa54bea89a52d8afe1b1a40ba9e30d37f446))
* **llm:** drop the provider toggle and dead ollama fields from settings ([d2191d0](https://github.com/bbaldino/family-dashboard/commit/d2191d06f28d1295c947215fd2f87f75a59c6b7c))
* **llm:** simplify to a single openai-compatible backend, add POST /generate ([bf6cf86](https://github.com/bbaldino/family-dashboard/commit/bf6cf861e57a9e03686274ab706f64f0ef5d5b5f))
* **nutrislice:** migrate lunch menu off the Rust backend onto fetch ([0cd55db](https://github.com/bbaldino/family-dashboard/commit/0cd55db9aa6d2bc2df8df4d8bb74fb2ee0112051))
* **on-this-day:** extract feed curation as pure functions ([6aeeb5c](https://github.com/bbaldino/family-dashboard/commit/6aeeb5c9d376ef79e0a34fde0d20ea4a8375cbb2))
* **on-this-day:** migrate to the fetch capability and browser-side LLM curation ([8c06793](https://github.com/bbaldino/family-dashboard/commit/8c0679322693e1aeafb14727e4c06fe1be0da23f))
* **platform:** migrate daily-quote off its Rust backend ([23e1fae](https://github.com/bbaldino/family-dashboard/commit/23e1fae55bb4a2d440c1e4b3f9d8749b5b8b70e7))
* **providers/google-calendar:** sync one broad event window per calendar ([8cabbb2](https://github.com/bbaldino/family-dashboard/commit/8cabbb25b35a6038e6f64cc51e9dd3c255ba2a8e))
* **providers/llm:** add a browser-callable generate() ([c5f2841](https://github.com/bbaldino/family-dashboard/commit/c5f28411838e54dd72de630328ca9fdbcdb5f8a3))
* **providers:** stand up a google-calendar provider ([e217956](https://github.com/bbaldino/family-dashboard/commit/e217956d0a8b8b46adad16f4af2f76f0706d508d))
* **sports:** add formatFinalDate for the final report kicker ([c613f1b](https://github.com/bbaldino/family-dashboard/commit/c613f1bb046cd91447a26ed809ddb111b6efde57))
* **themes:** let a theme declare its own settings, rendered on the theme page ([93ae225](https://github.com/bbaldino/family-dashboard/commit/93ae225ece981d38d5c7f28266112c87315badd6))


### Bug Fixes

* **admin/countdowns:** use the provider's useCalendarList instead of a raw api.get ([8ca7b66](https://github.com/bbaldino/family-dashboard/commit/8ca7b66b81b45d9651bf94b43a7d8e76d8b319ab))
* **admin/theme:** assert on resolved selection, not the always-present label ([7b5cc3b](https://github.com/bbaldino/family-dashboard/commit/7b5cc3b253b2f372fbdd382093086e9c8b25e43c))
* **admin:** clear a stale error when an action starts again ([482ada0](https://github.com/bbaldino/family-dashboard/commit/482ada0f96089e30de11f86f1e86c7de73a51c19))
* **backend/platform:** close redirect, cache-injectivity, and path-guard gaps found in review ([399bda3](https://github.com/bbaldino/family-dashboard/commit/399bda36eeedb1320e85fc4a4e0822bc769e73a2))
* **backend/platform:** cover the send-failure branch for headers/body leaks ([3f4acd7](https://github.com/bbaldino/family-dashboard/commit/3f4acd715bd85eaf1e26233490e80481b1488963))
* **backend/platform:** document and regression-test cache/config-removal behavior ([e7bad12](https://github.com/bbaldino/family-dashboard/commit/e7bad122138f271889d843fe281aa035affd5b9f))
* **backend/platform:** key the cache on resolved config so a change takes effect ([656a6f6](https://github.com/bbaldino/family-dashboard/commit/656a6f6a2f4b5eeca1efdaf6737bf8d3ec4a2c4e))
* **backend/platform:** let a cfg placeholder declare a fallback default ([88d777a](https://github.com/bbaldino/family-dashboard/commit/88d777acaa671f7f64a993a1a46b1dfb4b8e3b59))
* **backend/platform:** redact a secret's encoded form before its raw one ([c2ed3d6](https://github.com/bbaldino/family-dashboard/commit/c2ed3d66744caa204c7df418f8cbb9b34f4028d5))
* **backend/platform:** redact url-encoded secrets and stop leaking config keys ([8671a9c](https://github.com/bbaldino/family-dashboard/commit/8671a9c77fff3dbe98b634c60e3cc4b895e9954d))
* **backend/platform:** strip the URL reqwest silently reattaches to a send-failure log ([d3defae](https://github.com/bbaldino/family-dashboard/commit/d3defae57f13045d78728f67e1afad39e744364a))
* **backend/platform:** update stale scope note after task 2's new tests ([099585c](https://github.com/bbaldino/family-dashboard/commit/099585c49bf6291a424e7b9cb5dc6b01d71d941e))
* **backend/platform:** validate manifest base as a parsed URL, not a prefix ([6bf7c44](https://github.com/bbaldino/family-dashboard/commit/6bf7c44aaeeec38aa98b6f43c0ff72625397c143))
* **broadsheet:** lead with the last result instead of claiming no game today ([5c70bb8](https://github.com/bbaldino/family-dashboard/commit/5c70bb834dfeaa6ab0c5c9ac61674fd575f87de6))
* **broadsheet:** move the day's high/low out of the masthead ([d2f2b4b](https://github.com/bbaldino/family-dashboard/commit/d2f2b4bc3c1ef576b2321775a265bd01dd09fac0))
* **broadsheet:** say when the pregame preview is being written, or failed ([b2d5b24](https://github.com/bbaldino/family-dashboard/commit/b2d5b246386106508bad67411cedf79b51e8baab))
* **broadsheet:** set the date's ordinal on the numerals' cap line ([b2757fe](https://github.com/bbaldino/family-dashboard/commit/b2757fe445ac77058786626ca4cc041f83636e48))
* **broadsheet:** stop a long masthead title from wrecking the frame ([e9bf7da](https://github.com/bbaldino/family-dashboard/commit/e9bf7da913e8514c2975a5bd7d80e1d7b8e15ede))
* **broadsheet:** stop the masthead title wrapping, and tighten the frame ([2158ee6](https://github.com/bbaldino/family-dashboard/commit/2158ee67bec3a17a46a2435359f1f39a45fa6a13))
* **chores/people:** render avatars from person JSON instead of a nonexistent route ([d02f905](https://github.com/bbaldino/family-dashboard/commit/d02f90535e11093e3d5be73fb39ce7e8916da528))
* **chores/weeks:** copy and rotate a week atomically, and refuse a non-empty target ([f358248](https://github.com/bbaldino/family-dashboard/commit/f35824848dfbd75b703930221c4041c61e7fac8e))
* **chores/weeks:** word the copy refusal for a kitchen tablet ([a722bf4](https://github.com/bbaldino/family-dashboard/commit/a722bf4aaa5a2b486062f88b5683528b6128a1ee))
* **countdowns:** consume the google-calendar provider directly ([fe1563b](https://github.com/bbaldino/family-dashboard/commit/fe1563b986160c47d830de200d1885b61c6b0990))
* **countdowns:** refetch when horizon_days changes ([36a1792](https://github.com/bbaldino/family-dashboard/commit/36a179241b5bc76069d3c080f060a824186f86ef))
* **data/config:** close the reload gap with a refetch interval, not invalidation ([6181597](https://github.com/bbaldino/family-dashboard/commit/6181597b349c669652eef5235e195e316695478e))
* **data/config:** fetch the config table once instead of per consumer ([8cdcc72](https://github.com/bbaldino/family-dashboard/commit/8cdcc722d35b7157fd499a0c5c0c8d0fb4c6c860))
* **data/config:** say which integration and field are misconfigured ([d4f8895](https://github.com/bbaldino/family-dashboard/commit/d4f8895df47cca1ab3f8dfb1f743546c8d8bb747))
* **data/health:** pin `now` in the weekday-format test ([24d7cd8](https://github.com/bbaldino/family-dashboard/commit/24d7cd8a490bc030034aee7c40e5df1864367a5a))
* **doorbell:** parse the config values as the config table stores them ([66311e4](https://github.com/bbaldino/family-dashboard/commit/66311e431b5901d7b04ad887cbc1fd92a286e443))
* **driving-time:** gate the fetch guard on api_key, not the config object ([9771c59](https://github.com/bbaldino/family-dashboard/commit/9771c59b0d27eba8b0c125aef57d3b3ba85f0657))
* **driving-time:** treat an empty routes body as a failure, not zero minutes ([a605921](https://github.com/bbaldino/family-dashboard/commit/a60592197648ae636b76f6e1e420e61a48acc6b3))
* **frontend/data:** mark weather and daily-quote as having no backend ([134b9bb](https://github.com/bbaldino/family-dashboard/commit/134b9bb3527c22af9b602b42f42a08e790cdc9ce))
* **frontend/data:** stop gating air quality on an unused OpenWeatherMap key ([3f5d0a3](https://github.com/bbaldino/family-dashboard/commit/3f5d0a3a09dd4f2c1ff68f0ed11e20a1dd5f39c2))
* **frontend/platform:** make the enabled:false test actually discriminate ([9ef80ec](https://github.com/bbaldino/family-dashboard/commit/9ef80ec0500bb2fb31d982708731d165f8013168))
* **frontend/platform:** make useIntegrationData handle schema-less integrations ([c897c77](https://github.com/bbaldino/family-dashboard/commit/c897c770402471536e89173fe04deb9c6ecca3ae))
* **google-calendar:** keep the last week on screen while the ids change ([78d1869](https://github.com/bbaldino/family-dashboard/commit/78d186965fafa9ce800c28af6467e8db0d64a6bf))
* **google-calendar:** separate stored calendar ids from the fetch default ([612a3ad](https://github.com/bbaldino/family-dashboard/commit/612a3adc849b167f1beff6de512b82103f240252))
* **integrations/calendar:** correct the stale calendar_ids field description ([e906d53](https://github.com/bbaldino/family-dashboard/commit/e906d5334190c8ecfff26af244492035cff1386d))
* **llm:** bound the LLM client's timeout, fix an unfalsifiable test ([06493e2](https://github.com/bbaldino/family-dashboard/commit/06493e23bf979049650df9fa2f9ee3f7ccba18f3))
* **music/anchor:** pin the synced_to path and keep a self-omitting leader in the label ([e55f005](https://github.com/bbaldino/family-dashboard/commit/e55f00569be9aef27fb47a28b09fb907ca8f7ef5))
* **music:** anchor every music surface to the panel's own room ([61b859a](https://github.com/bbaldino/family-dashboard/commit/61b859ad1f3057d548b37545344bd4ba6d73aa01))
* **music:** read the room label as prose, not punctuation ([806c2b4](https://github.com/bbaldino/family-dashboard/commit/806c2b47e41cfde896c60408e85f324edcca8361))
* **on-this-day:** roll the local date over at midnight ([0b886db](https://github.com/bbaldino/family-dashboard/commit/0b886db4d72c89b529baabe640f732b9fea311b9))
* **palettes:** scope the palette to the dashboard, not the whole document ([f57f95d](https://github.com/bbaldino/family-dashboard/commit/f57f95de5d9524207a5c09d94fb5c387c3280d91))
* **platform:** close final-review gaps in fetch capability and its consumers ([05ba4ac](https://github.com/bbaldino/family-dashboard/commit/05ba4ac7fa33ef3fb4284b371541fff23af1ae53))
* **platform:** make a config save propagate without waiting out the poll ([bbf8a4a](https://github.com/bbaldino/family-dashboard/commit/bbf8a4a039b1bff9d0513c4ed628fe49ac1ee66f))
* **platform:** make functional refetchInterval receive the selected shape ([4d2b8c9](https://github.com/bbaldino/family-dashboard/commit/4d2b8c9c5c5746363235fd205712034f7161f93b))
* **platform:** name the request path in apiRequest's bodiless error fallback ([c38fb5d](https://github.com/bbaldino/family-dashboard/commit/c38fb5d94f628bfc707e3681267c181182c1303c))
* **providers/google-calendar:** stop calling a failed month "not connected" ([b756f25](https://github.com/bbaldino/family-dashboard/commit/b756f25d311533b46d5a25644102257802b40772))
* **sports:** ask ESPN for a date range instead of whatever "now" means ([3a1b89b](https://github.com/bbaldino/family-dashboard/commit/3a1b89b2b82ff605836881540ad46362108fd656))
* **sports:** identify to ESPN so its edge stops returning 403 ([1688add](https://github.com/bbaldino/family-dashboard/commit/1688addb4df318dd1b02ba7ddcb3e679ede18276))
* **sports:** tell the difference between no games and no ESPN ([3d6ccd7](https://github.com/bbaldino/family-dashboard/commit/3d6ccd7bc92f51ab300d0e923fd0e2c819e5f5cd))
* **themes/broadsheet:** point the AQI label comment at the thresholds' new home ([ee6e551](https://github.com/bbaldino/family-dashboard/commit/ee6e55147cea12975c2559c31ab9d0983b4ce6cb))
* **themes/grid:** derive GridSettingsPanel defaults from the schema ([0a1ced5](https://github.com/bbaldino/family-dashboard/commit/0a1ced585343f124b77568d0efacb16cd35b2cda))
* **themes/grid:** make the defaults test observe drift, derive input bounds from the schema ([2c4fd8d](https://github.com/bbaldino/family-dashboard/commit/2c4fd8da443c379b69edcf1d6e1faed218e42750))
* **themes/grid:** migrate WeatherDetail off the direct Rust forecast call ([022c3cc](https://github.com/bbaldino/family-dashboard/commit/022c3ccbf8ba7546e98d7b467aaffe8426f932b2))
* **themes/grid:** parse each theme.grid key independently ([4273df5](https://github.com/bbaldino/family-dashboard/commit/4273df5c281b54b53108b79ac4385f7143f46e9f))
* **themes/grid:** prefer stale forecast data over a transient poll error ([8941134](https://github.com/bbaldino/family-dashboard/commit/8941134952894e36eee0f9087c6ddc4a5820521a))
* **themes/grid:** rank health statuses in one place ([a30e925](https://github.com/bbaldino/family-dashboard/commit/a30e925553be7dc5d69c43b17ef409cdb2bc8ba2))
* **themes/grid:** read health through the integration, not raw fetch ([9bd82b4](https://github.com/bbaldino/family-dashboard/commit/9bd82b4b268f496ecc2ac9b6f5b367382068078a))
* **themes/grid:** read layout from theme.grid config instead of dashboard.* ([12577a5](https://github.com/bbaldino/family-dashboard/commit/12577a501eafb754ba91bb242b10f396f1fc0cb3))
* **themes/grid:** stop duplicating health's data types ([99c1e9c](https://github.com/bbaldino/family-dashboard/commit/99c1e9c455155b4b3458c9ccd5dce19b219fa08a))
* **themes/grid:** use the shared conditionIcons map in WeatherDetail ([9ed6e52](https://github.com/bbaldino/family-dashboard/commit/9ed6e52b23daeda841d8917cb58274a7f3d29127))
* **themes:** single-source grid's setting labels, drop the partial generic form ([3303788](https://github.com/bbaldino/family-dashboard/commit/3303788efcd204f063346801de291dabe4683f96))
* **themes:** stop an unrelated config save from wiping in-progress swatches ([bf06607](https://github.com/bbaldino/family-dashboard/commit/bf06607e00a34e3197c22a28fcb1a958c95d96f2))
* **themes:** tell the user when a palette save fails, and undo the optimistic switch ([1c687e2](https://github.com/bbaldino/family-dashboard/commit/1c687e2b53491c4dc97fed949249ced9b2a73d72))
* **word-of-the-day:** bucket feed items by their nominal date, not the viewer's ([bd9bc23](https://github.com/bbaldino/family-dashboard/commit/bd9bc23f782ddc915e16a60dd8568a8f74896a68))
* **word-of-the-day:** migrate to the fetch capability and stop scraping HTML ([dec838a](https://github.com/bbaldino/family-dashboard/commit/dec838a905d0e92cecad4e29662abe25f52ddcec))


### Performance Improvements

* **calendar:** read the month grid from the synced window ([82ed5c1](https://github.com/bbaldino/family-dashboard/commit/82ed5c1785bc13808a6970fde7a7b60ec5701d06))
* **calendar:** read the week strip and assignments row from the synced window ([1b41ab4](https://github.com/bbaldino/family-dashboard/commit/1b41ab4a33a6533d2bba885d0751140b164bcb91))

## [0.4.3](https://github.com/bbaldino/family-dashboard/compare/v0.4.2...v0.4.3) (2026-08-03)


### Bug Fixes

* **chores:** make optimistic revert concurrency-safe ([b455515](https://github.com/bbaldino/family-dashboard/commit/b4555152419866fe2a51480a2b8422ea99da12d7))
* **data/chores:** flip a chore optimistically and revert on failure ([20c9a3d](https://github.com/bbaldino/family-dashboard/commit/20c9a3da36de84416f5e40a55c9b6c76f067c92b))
* **themes/broadsheet:** let a chore be checked and unchecked from the tablet ([8456a88](https://github.com/bbaldino/family-dashboard/commit/8456a88aa4ada19b2e739a682f4ddad1c6b96092))

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
