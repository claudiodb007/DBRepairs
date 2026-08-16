import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  createCustomer,
  Customer,
  CustomerInput,
  deleteCustomer,
  listCustomers,
  updateCustomer,
} from "../data/customers";
import { useI18n } from "../i18n/I18nProvider";

const emptyCustomer: CustomerInput = {
  name: "",
  company: "",
  taxNumber: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

function toInput(customer: Customer): CustomerInput {
  return {
    name: customer.name,
    company: customer.company ?? "",
    taxNumber: customer.tax_number ?? "",
    phone: customer.phone ?? "",
    email: customer.email ?? "",
    address: customer.address ?? "",
    notes: customer.notes ?? "",
  };
}

export default function CustomersPage() {
  const { t } = useI18n();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerInput>(emptyCustomer);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async (query = search) => {
    setLoading(true);
    setError("");
    try {
      setCustomers(await listCustomers(query));
    } catch (cause) {
      console.error(cause);
      setError(t("common.databaseError"));
    } finally {
      setLoading(false);
    }
  }, [search, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(search), 180);
    return () => window.clearTimeout(timer);
  }, [search, refresh]);

  function openCreate() {
    setEditing(null);
    setForm(emptyCustomer);
    setError("");
    setFormOpen(true);
  }

  function openEdit(customer: Customer) {
    setEditing(customer);
    setForm(toInput(customer));
    setError("");
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setEditing(null);
    setForm(emptyCustomer);
  }

  function updateField(field: keyof CustomerInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return;

    setSaving(true);
    setError("");
    try {
      if (editing) await updateCustomer(editing.id, form);
      else await createCustomer(form);
      closeForm();
      await refresh(search);
    } catch (cause) {
      console.error(cause);
      setError(t("common.saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function remove(customer: Customer) {
    if (!window.confirm(t("customers.deleteConfirm").replace("{name}", customer.name))) return;
    setError("");
    try {
      await deleteCustomer(customer.id);
      await refresh(search);
    } catch (cause) {
      console.error(cause);
      setError(t("customers.deleteBlocked"));
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{t("customers.title")}</h1>
          <p>{t("customers.subtitle")}</p>
        </div>
        <button className="primary" onClick={openCreate}>+ {t("customers.new")}</button>
      </header>

      <section className="panel customers-panel">
        <div className="toolbar">
          <input
            className="search-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("customers.search")}
            aria-label={t("customers.search")}
          />
          <span className="muted">{t("customers.count").replace("{count}", String(customers.length))}</span>
        </div>

        {error && <div className="alert error">{error}</div>}

        {loading ? (
          <div className="empty-state compact">{t("common.loading")}</div>
        ) : customers.length === 0 ? (
          <div className="empty-state compact">
            <strong>{search ? t("customers.noResults") : t("customers.empty")}</strong>
            {!search && <span>{t("customers.emptyHint")}</span>}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("customer.name")}</th>
                  <th>{t("customer.company")}</th>
                  <th>{t("customer.phone")}</th>
                  <th>{t("customer.email")}</th>
                  <th>{t("customer.taxNumber")}</th>
                  <th className="actions-column">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td><strong>{customer.name}</strong></td>
                    <td>{customer.company || "—"}</td>
                    <td>{customer.phone || "—"}</td>
                    <td>{customer.email || "—"}</td>
                    <td>{customer.tax_number || "—"}</td>
                    <td className="row-actions">
                      <button className="secondary small" onClick={() => openEdit(customer)}>{t("common.edit")}</button>
                      <button className="danger-link small" onClick={() => void remove(customer)}>{t("common.delete")}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeForm();
        }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="customer-form-title">
            <div className="modal-head">
              <div>
                <h2 id="customer-form-title">{editing ? t("customers.edit") : t("customers.new")}</h2>
                <p>{t("customers.formHint")}</p>
              </div>
              <button className="icon-button" type="button" onClick={closeForm} aria-label={t("common.close")}>×</button>
            </div>

            <form onSubmit={(event) => void submit(event)}>
              <div className="form-grid">
                <label className="field full">
                  <span>{t("customer.name")} *</span>
                  <input autoFocus required value={form.name} onChange={(event) => updateField("name", event.target.value)} />
                </label>
                <label className="field">
                  <span>{t("customer.company")}</span>
                  <input value={form.company} onChange={(event) => updateField("company", event.target.value)} />
                </label>
                <label className="field">
                  <span>{t("customer.taxNumber")}</span>
                  <input value={form.taxNumber} onChange={(event) => updateField("taxNumber", event.target.value)} />
                </label>
                <label className="field">
                  <span>{t("customer.phone")}</span>
                  <input value={form.phone} onChange={(event) => updateField("phone", event.target.value)} />
                </label>
                <label className="field">
                  <span>{t("customer.email")}</span>
                  <input type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} />
                </label>
                <label className="field full">
                  <span>{t("customer.address")}</span>
                  <input value={form.address} onChange={(event) => updateField("address", event.target.value)} />
                </label>
                <label className="field full">
                  <span>{t("customer.notes")}</span>
                  <textarea rows={4} value={form.notes} onChange={(event) => updateField("notes", event.target.value)} />
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="secondary" onClick={closeForm}>{t("common.cancel")}</button>
                <button type="submit" className="primary" disabled={saving || !form.name.trim()}>
                  {saving ? t("common.saving") : t("common.save")}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
