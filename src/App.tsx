import SecretKeyTool from "./components/SecretKeyTool";
import Base58SecretTool from "./components/Base58SecretTool";
import PDATool from "./components/PDATool";
import AccountDataTool from "./components/AccountDataTool";

function App() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <header className="mb-8">
          <h1 className="text-2xl font-bold">Solana Dev Tools</h1>
        </header>
        <main className="space-y-8">
          <section className="rounded-lg border border-neutral-800 p-5">
            <SecretKeyTool />
          </section>
          <section className="rounded-lg border border-neutral-800 p-5">
            <Base58SecretTool />
          </section>
          <section className="rounded-lg border border-neutral-800 p-5">
            <PDATool />
          </section>
          <section className="rounded-lg border border-neutral-800 p-5">
            <AccountDataTool />
          </section>
        </main>
      </div>
    </div>
  );
}

export default App
