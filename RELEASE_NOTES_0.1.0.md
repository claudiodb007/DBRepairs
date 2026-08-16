# DBRepairs 0.1.0

First public release of DBRepairs.

DBRepairs is a lightweight open-source repair-shop manager designed for practical workshop and service-centre workflows.

## Included in 0.1.0

### Customers
- Customer creation, editing, search and deletion.
- Company, tax number, phone, email, address and notes.
- Repair history visible directly in the customer record.
- Quick customer creation from the new repair form.

### Repairs
- Repair intake and editing.
- Automatic repair numbering.
- Device type, brand, model, serial number and IMEI.
- Reported fault, accessories and general condition.
- Diagnosis and work performed.
- Estimated and final values.
- Internal notes.
- Repair search and filters.
- Suggestions for previously used device types, brands and models.

### Status tracking
- Received.
- Diagnosis.
- Waiting for customer.
- Waiting for parts.
- In repair.
- Repaired.
- Ready.
- Delivered.
- Cancelled.
- Full timestamped status history.
- Optional note on status changes.

### Printing
- One A4 portrait page with two repair slips.
- Workshop copy and customer copy.
- Company details and custom logo.
- Save-and-print workflow.

### Dashboard
- Open repairs.
- Waiting for customer.
- Ready for collection.
- Closed today.
- Recent repairs.

### Settings and data
- Portuguese (Portugal), English, Spanish and French.
- One global application/printing language.
- Company identity settings.
- Custom logo.
- SQLite database backup.
- Customer CSV export.
- Repair CSV export.

## Linux packages

This release provides:

- `DBRepairs_0.1.0_amd64.deb`
- `DBRepairs-0.1.0-1.x86_64.rpm`

### Debian / Ubuntu

```bash
sudo apt install ./DBRepairs_0.1.0_amd64.deb
```

### Fedora / RHEL compatible distributions

```bash
sudo dnf install ./DBRepairs-0.1.0-1.x86_64.rpm
```

## Notes

- Windows packaging is planned but is not part of this Linux-first 0.1.0 release.
- Docker/server mode is planned for a later release.
- AppImage packaging will be added after compatibility testing on a controlled Linux build environment.

## License

GPL-3.0.
