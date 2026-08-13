"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type AccountOption = {
  id: string;
  accountLabel: string;
  platformLabel: string;
};

type ActionResult =
  | "images-queued"
  | "reels-queued"
  | "images-paused"
  | "reels-paused"
  | "missing-accounts";

type ActionFn = (formData: FormData) => Promise<ActionResult>;

function getButtonLabel(action: string | null, target: string, idle: string, working: string) {
  return action === target ? working : idle;
}

function getStatusMessage(result: ActionResult | null) {
  if (result === "images-queued") {
    return "The daily image plan was queued successfully.";
  }

  if (result === "reels-queued") {
    return "The daily reel plan was queued successfully.";
  }

  if (result === "images-paused") {
    return "The daily image plan was paused successfully.";
  }

  if (result === "reels-paused") {
    return "The daily reel plan was paused successfully.";
  }

  if (result === "missing-accounts") {
    return "Select at least one connected account first.";
  }

  return null;
}

export function AutoPostPlanForm(props: {
  accounts: AccountOption[];
  scheduleYearImagesAction: ActionFn;
  scheduleYearReelsAction: ActionFn;
  pauseYearImagesAction: ActionFn;
  pauseYearReelsAction: ActionFn;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [status, setStatus] = useState<ActionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isWorking = isPending && pendingAction !== null;

  function runAction(actionName: string, action: ActionFn) {
    const formElement = formRef.current;

    if (!formElement) {
      return;
    }

    setPendingAction(actionName);
    setStatus(null);
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const formData = new FormData(formElement);
        const result = await action(formData);
        setStatus(result);
        router.refresh();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Automation plan request failed.");
      } finally {
        setPendingAction(null);
      }
    });
  }

  const statusMessage = getStatusMessage(status);

  return (
    <form ref={formRef} className="form-grid simple-form" id="autopost-form">
      <div className="stack">
        <p className="muted">Choose which connected accounts should receive the numbered daily image and reel libraries.</p>
        {props.accounts.length ? (
          props.accounts.map((account) => (
            <label key={account.id} className="calendar-event">
              <input type="checkbox" name="accountIds" value={account.id} defaultChecked disabled={isWorking} />
              {" "}
              <strong>{account.accountLabel}</strong>
              <div className="muted">{account.platformLabel}</div>
            </label>
          ))
        ) : (
          <div className="calendar-event">Connect at least one account first.</div>
        )}
      </div>

      <div className="stack">
        <label>Daily post time</label>
        <input className="input" type="time" name="autopostTime" defaultValue="09:00" disabled={isWorking} />
        <div className="muted">This single time is used for both the daily image and the daily reel queue.</div>
      </div>
      <div className="muted">
        Vercel Hobby cron runs once per day, so using one shared time keeps the image and reel plan aligned with the same daily publish window.
      </div>

      <div className="toolbar toolbar-start">
        <button
          className={`button ${pendingAction === "queue-images" ? "working" : ""}`}
          type="button"
          disabled={isWorking}
          onClick={() => runAction("queue-images", props.scheduleYearImagesAction)}
        >
          {getButtonLabel(pendingAction, "queue-images", "Queue all year images", "Queueing images...")}
        </button>
        <button
          className={`button secondary ${pendingAction === "pause-images" ? "working" : ""}`}
          type="button"
          disabled={isWorking}
          onClick={() => runAction("pause-images", props.pauseYearImagesAction)}
        >
          {getButtonLabel(pendingAction, "pause-images", "Pause images", "Pausing images...")}
        </button>
      </div>

      <div className="toolbar toolbar-start">
        <button
          className={`button ${pendingAction === "queue-reels" ? "working" : ""}`}
          type="button"
          disabled={isWorking}
          onClick={() => runAction("queue-reels", props.scheduleYearReelsAction)}
        >
          {getButtonLabel(pendingAction, "queue-reels", "Queue all year reels", "Queueing reels...")}
        </button>
        <button
          className={`button secondary ${pendingAction === "pause-reels" ? "working" : ""}`}
          type="button"
          disabled={isWorking}
          onClick={() => runAction("pause-reels", props.pauseYearReelsAction)}
        >
          {getButtonLabel(pendingAction, "pause-reels", "Pause reels", "Pausing reels...")}
        </button>
      </div>

      {isWorking ? (
        <div className="calendar-event action-feedback">
          Working on your automation plan now. The queue will refresh when the action finishes.
        </div>
      ) : null}

      {statusMessage ? <div className="calendar-event action-feedback success">{statusMessage}</div> : null}
      {errorMessage ? <div className="calendar-event">{errorMessage}</div> : null}
    </form>
  );
}
