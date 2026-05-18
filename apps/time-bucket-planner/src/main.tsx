import * as React from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import "./styles.css";

const storageKey = "time-bucket-planner:v1";

const buckets = [
  { id: "todo", label: "やりたいことリスト", tone: "todo" },
  { id: "20s", label: "20代", tone: "green" },
  { id: "30s", label: "30代", tone: "cyan" },
  { id: "40s", label: "40代", tone: "blue" },
  { id: "50s", label: "50代", tone: "indigo" },
  { id: "60s", label: "60代", tone: "amber" },
  { id: "70s", label: "70代", tone: "orange" },
  { id: "80s", label: "80代", tone: "rose" },
] as const;

type BucketId = (typeof buckets)[number]["id"];

type BucketItem = {
  id: string;
  title: string;
  bucketId: BucketId;
};

function createId() {
  if ("crypto" in window && "randomUUID" in window.crypto) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readItems(): BucketItem[] {
  const storedValue = window.localStorage.getItem(storageKey);
  if (!storedValue) return [];

  try {
    const parsed = JSON.parse(storedValue) as { items?: BucketItem[] };
    const bucketIds = new Set<BucketId>(buckets.map((bucket) => bucket.id));
    return (parsed.items ?? [])
      .filter((item) => item && typeof item.id === "string" && typeof item.title === "string")
      .map((item) => ({
        id: item.id,
        title: item.title,
        bucketId: bucketIds.has(item.bucketId) ? item.bucketId : "todo",
      }));
  } catch {
    return [];
  }
}

function App() {
  const [items, setItems] = usePersistentItems();
  const [newTitle, setNewTitle] = React.useState("");
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [dragOverBucketId, setDragOverBucketId] = React.useState<BucketId | null>(null);
  const [dragOverItemId, setDragOverItemId] = React.useState<string | null>(null);

  const addItem = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setItems((current) => [{ id: createId(), title, bucketId: "todo" }, ...current]);
    setNewTitle("");
  };

  const moveItem = (itemId: string, bucketId: BucketId, beforeItemId?: string) => {
    setItems((current) => {
      const movingItem = current.find((item) => item.id === itemId);
      if (!movingItem) return current;

      const remainingItems = current.filter((item) => item.id !== itemId);
      const movedItem = { ...movingItem, bucketId };
      if (!beforeItemId || beforeItemId === itemId) return [...remainingItems, movedItem];

      const targetIndex = remainingItems.findIndex((item) => item.id === beforeItemId);
      if (targetIndex < 0) return [...remainingItems, movedItem];

      return [...remainingItems.slice(0, targetIndex), movedItem, ...remainingItems.slice(targetIndex)];
    });
  };

  const removeItem = (itemId: string) => {
    setItems((current) => current.filter((item) => item.id !== itemId));
  };

  return (
    <main className="app">
      <section className="hero" aria-labelledby="page-title">
        <div className="hero-surface">
          <h1 id="page-title">
            タイムバケット
            <br />
            プランナー
          </h1>
        </div>
      </section>

      <section className="workspace" aria-label="タイムバケット・プランナー">
        <header className="intro">
          <h2>タイムバケット・プランナー</h2>
          <p>『DIE WITH ZERO』より、人生でやりたいことを年代ごとに計画しよう</p>
        </header>

        <form className="add-panel" onSubmit={addItem}>
          <label htmlFor="new-bucket-item">やりたいことを追加</label>
          <div className="add-row">
            <input
              id="new-bucket-item"
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="例：オーロラを見る"
            />
            <button type="submit">
              <Plus size={18} />
              追加
            </button>
          </div>
        </form>

        <div className="bucket-grid">
          {buckets.map((bucket) => {
            const bucketItems = items.filter((item) => item.bucketId === bucket.id);

            return (
              <section
                key={bucket.id}
                className="bucket"
                data-tone={bucket.tone}
                data-drag-over={dragOverBucketId === bucket.id}
                onDragEnter={() => setDragOverBucketId(bucket.id)}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOverBucketId(bucket.id);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setDragOverBucketId(null);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggingId) moveItem(draggingId, bucket.id);
                  setDraggingId(null);
                  setDragOverBucketId(null);
                  setDragOverItemId(null);
                }}
              >
                <h3>{bucket.label}</h3>
                {bucket.id === "todo" && <div className="title-rule" />}
                <div className="item-list">
                  {bucketItems.map((item) => (
                    <article
                      key={item.id}
                      className="bucket-item"
                      data-drag-over={dragOverItemId === item.id}
                      draggable
                      onDragStart={() => setDraggingId(item.id)}
                      onDragEnter={() => {
                        if (draggingId !== item.id) setDragOverItemId(item.id);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (draggingId !== item.id) setDragOverItemId(item.id);
                      }}
                      onDragLeave={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                          setDragOverItemId(null);
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (draggingId && draggingId !== item.id) moveItem(draggingId, bucket.id, item.id);
                        setDraggingId(null);
                        setDragOverBucketId(null);
                        setDragOverItemId(null);
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDragOverBucketId(null);
                        setDragOverItemId(null);
                      }}
                    >
                      <div className="item-main">
                        <GripVertical size={16} className="drag-icon" />
                        <span>{item.title}</span>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => removeItem(item.id)}
                          aria-label={`${item.title}を削除`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </article>
                  ))}
                  {bucketItems.length === 0 && <div className="empty-state">ここに移動</div>}
                </div>
              </section>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function usePersistentItems() {
  const [items, setItems] = React.useState<BucketItem[]>(readItems);

  React.useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify({ items }));
  }, [items]);

  return [items, setItems] as const;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
