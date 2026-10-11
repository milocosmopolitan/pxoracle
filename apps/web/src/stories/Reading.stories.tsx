import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ReadingResult,
  PerspectiveFields,
  ReadingFailure,
  LegacyPerspective,
  UnsupportedReading,
} from "../features/tarot/ReadingResult";
import type { Context, ReadingPlan } from "@pxoracle/contracts/reading";
import type { ProsePack } from "../features/tarot/reading";
import fixtures from "../../../../tests/fixtures/readings.json";
import prose from "../../../../content/tarot/reading/reading.en.1.1.json";
const meta = {
  title: "PXOracle/Free reading",
  parameters: { layout: "padded" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
function Example({ label = "relationships-present" }: { label?: string }) {
  const [focus, setFocus] = useState<number | null>(null);
  return (
    <div className="panel" style={{ maxWidth: 650 }}>
      <p className="eyebrow">SYNTHETIC FIXTURE · NATIVE RUST OUTPUT</p>
      <ReadingResult
        plan={fixtures.find((f) => f.label === label)!.plan as ReadingPlan}
        pack={prose as ProsePack}
        focus={focus}
        onFocus={setFocus}
      />
      <p role="status">
        {focus === null ? "All cards" : `Card ${focus + 1} selected`}
      </p>
    </div>
  );
}
export const Representative: Story = { render: () => <Example /> };
export const AllReversed: Story = {
  render: () => <Example label="all-reversed" />,
};
export const WeakRelationship: Story = {
  render: () => <Example label="fallback" />,
};
export const Complement: Story = {
  render: () => <Example label="complement" />,
};
export const RepeatedTheme: Story = {
  render: () => <Example label="repetition" />,
};
export const Mobile: Story = {
  render: () => (
    <div style={{ width: 340, maxWidth: "100%" }}>
      <Example label="growth-action" />
    </div>
  ),
  globals: { viewport: { value: "mobile1", isRotated: false } },
};
export const Keyboard: Story = {
  render: () => (
    <>
      <p>
        Tab to a card name and press Enter. Focus selects that same card index.
      </p>
      <Example />
    </>
  ),
};
function Perspectives() {
  const [context, setContext] = useState<Context>({
    topic: "relationships",
    intent: "present",
  });
  return (
    <>
      <PerspectiveFields value={context} onChange={setContext} />
      <Example label={`${context.topic}-${context.intent}`} />
    </>
  );
}
export const AllTwelvePerspectives: Story = { render: () => <Perspectives /> };
function Retry() {
  const [failed, setFailed] = useState(true);
  return failed ? (
    <ReadingFailure retry={() => setFailed(false)} />
  ) : (
    <Example />
  );
}
export const ErrorAndRetry: Story = { render: () => <Retry /> };
function Legacy() {
  const [chosen, setChosen] = useState(false),
    [context, setContext] = useState<Context>({
      topic: "relationships",
      intent: "present",
    });
  return chosen ? (
    <Example label={`${context.topic}-${context.intent}`} />
  ) : (
    <LegacyPerspective
      value={context}
      onChange={setContext}
      onConfirm={() => setChosen(true)}
    />
  );
}
export const LegacySession: Story = { render: () => <Legacy /> };
function VersionChange() {
  const [confirmed, setConfirmed] = useState(false);
  return confirmed ? (
    <Example />
  ) : (
    <UnsupportedReading onConfirm={() => setConfirmed(true)} />
  );
}
export const UnsupportedVersion: Story = { render: () => <VersionChange /> };
