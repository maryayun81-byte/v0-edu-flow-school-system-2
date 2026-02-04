# Build Instructions

## PowerShell Execution Policy Issue

If you're getting the error:
```
pnpm : File C:\Users\LENOVO\AppData\Roaming\npm\pnpm.ps1 cannot be loaded because running scripts is disabled on this system.
```

### Solution:

**Option 1: Enable for Current Session (Temporary)**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
```
Then run:
```powershell
pnpm run build
```

**Option 2: Enable Permanently (Recommended)**
1. Open PowerShell as Administrator
2. Run:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
3. Type `Y` to confirm
4. Close and reopen your terminal
5. Run:
```powershell
pnpm run build
```

**Option 3: Use CMD Instead**
Open Command Prompt (cmd.exe) instead of PowerShell and run:
```cmd
pnpm run build
```

---

## Development Server

To run the development server:
```bash
pnpm run dev
```

Then open http://localhost:3000 in your browser.

---

## Production Build

To create a production build:
```bash
pnpm run build
```

To start the production server:
```bash
pnpm run start
```

---

## What Was Fixed

✅ Created missing `tabs.tsx` component in `components/ui/`
✅ All imports should now resolve correctly
✅ Build should complete successfully once PowerShell execution policy is enabled
