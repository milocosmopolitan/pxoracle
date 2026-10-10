# Storybook

`npm run storybook` / `npm run build-storybook`. React/Vite adapter uses production components and scene code. Fixture data comes from native/WASM parity output and is visibly labeled MOCK. Injected engine methods never instantiate real workers. Art loading remains real.

Stories: Landing; AstrologyInput; AstrologyReading; TarotInput; TarotReading; LoadingState; RetryState; MobileTarot. Controls: route, state, width, frozen animation. OS reduced-motion settings are respected by the production runtime and styles. StateProvider resets with each story mount; scene teardown disposes owned resources.

The mock methods are presentation fixtures, not an alternate validated tarot algorithm. Routes/history, failure recovery, network isolation, and actual numerical calculations belong to application/engine tests. The standalone Storybook build is not included in the S3 app output.

Build is verified. Live story interaction and visual approval require the browser qualification gate; merely building is not evidence of visual fidelity or HMR cleanup.
