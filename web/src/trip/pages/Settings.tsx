import { useRef, useState, type FormEvent } from "react";
import { backupJson, downloadFile, parseBackup, transactionsCsv } from "../backup";
import LockSettings from "../components/LockSettings";
import SyncSettings from "../components/SyncSettings";
import { formatDate, formatMoney, today } from "../money";
import { useTrip } from "../store";

// Your budget and dates, backups, and privacy information.

const toPounds = (pence: number) => (pence ? String(pence / 100) : "");
const toPence = (pounds: string) => Math.round((parseFloat(pounds.replace(/[£,]/g, "")) || 0) * 100);

export default function Settings() {
  const trip = useTrip();
  const { settings } = trip;
  const [budget, setBudget] = useState(toPounds(settings.totalBudget));
  const [start, setStart] = useState(settings.budgetStartDate);
  const [departure, setDeparture] = useState(settings.departureDate);
  const [ret, setRet] = useState(settings.returnDate);
  const [family, setFamily] = useState(toPounds(settings.familySupportMonthly));
  const [senders, setSenders] = useState(settings.familySenders.join(", "));
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    await trip.saveSettings({
      ...settings,
      totalBudget: toPence(budget),
      budgetStartDate: start,
      departureDate: departure,
      returnDate: ret,
      familySupportMonthly: toPence(family),
      familySenders: senders.split(",").map((s) => s.trim()).filter(Boolean),
    });
    flash("Saved ✓");
  }

  function flash(text: string) {
    setMessage(text);
    setTimeout(() => setMessage(null), 3000);
  }

  async function exportBackup() {
    downloadFile(`gap-year-backup-${today()}.json`, backupJson(trip.exportData()), "application/json");
    await trip.markBackedUp();
    flash("Backup saved ✓ Keep the file somewhere safe, like iCloud Drive.");
  }

  async function restore(file: File) {
    try {
      const data = parseBackup(await file.text());
      if (!confirm(`Replace everything on this device with this backup (${data.transactions.length} transactions)?`)) return;
      await trip.replaceAll(data);
      flash("Backup restored ✓");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't read that file.");
    }
  }

  async function clearEverything() {
    if (!confirm("Delete all My Trip data on this device? This can't be undone unless you have a backup.")) return;
    await trip.clearAll();
    flash("All data deleted from this device.");
  }

  return (
    <div className="grid grid-cols-1 gap-5">
      <form onSubmit={save} className="card grid gap-4">
        <h2 className="text-xl font-extrabold">💷 Budget and dates</h2>
        <label className="label">Total money for your gap year (£)
          <input className="input" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. 12000" />
          <span className="text-xs font-normal text-muted">Savings you have for the trip. Family support is added separately below.</span>
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="label">Count spending from
            <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="label">Departure date
            <input className="input" type="date" value={departure} onChange={(e) => setDeparture(e.target.value)} />
          </label>
          <label className="label">Return date
            <input className="input" type="date" value={ret} onChange={(e) => setRet(e.target.value)} />
          </label>
        </div>
        <h3 className="pt-2 text-lg font-bold">👪 Family support</h3>
        <label className="label">Expected each month (£)
          <input className="input" inputMode="decimal" value={family} onChange={(e) => setFamily(e.target.value)} placeholder="e.g. 200" />
        </label>
        <label className="label">Names that appear on family payments
          <input className="input" value={senders} onChange={(e) => setSenders(e.target.value)} placeholder="e.g. Mum, Dad, J Smith" />
          <span className="text-xs font-normal text-muted">Separate with commas. Payments from these are marked as family support.</span>
        </label>
        <div className="flex items-center gap-3">
          <button className="btn">Save</button>
          {message && <span className="text-sm font-semibold text-good">{message}</span>}
        </div>
      </form>

      <SyncSettings />

      <LockSettings />

      <section id="backup" className="card grid gap-3">
        <h2 className="text-xl font-extrabold">💾 Backup</h2>
        <p className="text-sm text-muted">
          Your data is stored only on this device. Back up regularly so you don't lose it if your phone is lost or Safari data is cleared.
          {settings.lastBackupAt && <> Last backup: <b>{formatDate(settings.lastBackupAt.slice(0, 10), "long")}</b>.</>}
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          <button className="btn" onClick={exportBackup}>Export backup</button>
          <button className="btn-soft" onClick={() => fileInput.current?.click()}>Restore backup</button>
          <button className="btn-soft" onClick={() => downloadFile(`transactions-${today()}.csv`, transactionsCsv(trip.exportData()), "text/csv")}>
            Export CSV
          </button>
        </div>
        <input ref={fileInput} type="file" accept=".json,application/json" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void restore(f); e.target.value = ""; }} />
      </section>

      <section className="card grid gap-2 text-sm">
        <h2 className="text-xl font-extrabold">🔒 Privacy and storage</h2>
        <p>• Statements are read on this device. Transactions, budgets and plans are saved <b>on this device</b>. If you turn on sync, they're also uploaded <b>encrypted</b> with your passphrase, so the website can't read them.</p>
        <p>• <b>iPhone:</b> add the app to your Home Screen (Safari → Share → Add to Home Screen). Safari can delete website data that isn't used for a while, but home-screen apps are kept. It can still be lost if the app is removed or storage runs out, so keep backups.</p>
        <p>• Each account has its own separate storage, so someone else logging in on this device won't see your data.</p>
        <p className="text-muted">{trip.transactions.length} transactions stored · budget {formatMoney(settings.totalBudget, true)}</p>
      </section>

      <button onClick={clearEverything} className="min-h-12 rounded-2xl font-semibold text-bad ring-1 ring-bad/30">
        Delete all My Trip data on this device
      </button>
    </div>
  );
}
