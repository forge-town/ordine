param(
  [Parameter(Mandatory = $true)][string]$Executable,
  [Parameter(Mandatory = $true)][string]$ExecutableSha256,
  [Parameter(Mandatory = $true)][string]$ArgumentsPath,
  [Parameter(Mandatory = $true)][string]$CancellationPath,
  [Parameter(Mandatory = $true)][string]$ChildTemp
)
$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $OutputEncoding
[Console]::InputEncoding = $OutputEncoding
# This fixed launcher controls process lifetime; it is not an OS access sandbox.
# Job-list process creation assigns the child atomically, before any child code can run.
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;

public static class OrdineScriptJob {
  [StructLayout(LayoutKind.Sequential)] struct BasicLimits {
    public long ProcessTime, JobTime; public uint Flags;
    public UIntPtr MinWorkingSet, MaxWorkingSet; public uint ActiveProcessLimit;
    public UIntPtr Affinity; public uint PriorityClass, SchedulingClass;
  }
  [StructLayout(LayoutKind.Sequential)] struct IoCounters {
    public ulong ReadOperations, WriteOperations, OtherOperations, ReadBytes, WriteBytes, OtherBytes;
  }
  [StructLayout(LayoutKind.Sequential)] struct ExtendedLimits {
    public BasicLimits Basic; public IoCounters Io;
    public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory;
  }
  [StructLayout(LayoutKind.Sequential)] struct Accounting {
    public long UserTime, KernelTime, PeriodUserTime, PeriodKernelTime;
    public uint PageFaults, TotalProcesses, ActiveProcesses, TerminatedProcesses;
  }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] struct StartupInfo {
    public int Size; public string Reserved, Desktop, Title;
    public int X, Y, Width, Height, XChars, YChars, Fill, Flags;
    public short ShowWindow, ReservedBytes; public IntPtr ReservedPointer, Stdin, Stdout, Stderr;
  }
  [StructLayout(LayoutKind.Sequential)] struct StartupInfoEx { public StartupInfo Info; public IntPtr Attributes; }
  [StructLayout(LayoutKind.Sequential)] struct ProcessInfo { public IntPtr Process, Thread; public uint ProcessId, ThreadId; }
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] static extern IntPtr CreateJobObject(IntPtr security, string name);
  [DllImport("kernel32.dll", SetLastError = true)] static extern bool SetInformationJobObject(IntPtr job, int infoClass, ref ExtendedLimits info, uint length);
  [DllImport("kernel32.dll", SetLastError = true)] static extern bool QueryInformationJobObject(IntPtr job, int infoClass, out Accounting info, uint length, IntPtr returnedLength);
  [DllImport("kernel32.dll", SetLastError = true)] static extern bool TerminateJobObject(IntPtr job, uint exitCode);
  [DllImport("kernel32.dll", SetLastError = true)] static extern bool InitializeProcThreadAttributeList(IntPtr list, int count, int flags, ref IntPtr size);
  [DllImport("kernel32.dll", SetLastError = true)] static extern bool UpdateProcThreadAttribute(IntPtr list, uint flags, IntPtr attribute, IntPtr value, IntPtr size, IntPtr previous, IntPtr returned);
  [DllImport("kernel32.dll")] static extern void DeleteProcThreadAttributeList(IntPtr list);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] static extern bool CreateProcess(string application, StringBuilder commandLine, IntPtr processSecurity, IntPtr threadSecurity, bool inheritHandles, uint flags, IntPtr environment, string directory, ref StartupInfoEx startup, out ProcessInfo process);
  [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int id);
  [DllImport("kernel32.dll", SetLastError = true)] static extern bool SetHandleInformation(IntPtr handle, uint mask, uint flags);
  [DllImport("kernel32.dll", SetLastError = true)] static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
  [DllImport("kernel32.dll", SetLastError = true)] static extern bool GetExitCodeProcess(IntPtr process, out uint code);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);

  static void Check(bool success) { if (!success) throw new Win32Exception(Marshal.GetLastWin32Error()); }
  // Win32 argv quoting, with no command shell involved.
  static string Quote(string value) {
    StringBuilder result = new StringBuilder("\""); int slashes = 0;
    foreach (char c in value) {
      if (c == '\\') { slashes++; continue; }
      if (c == '"') { result.Append('\\', slashes * 2 + 1); result.Append('"'); slashes = 0; continue; }
      result.Append('\\', slashes); slashes = 0; result.Append(c);
    }
    result.Append('\\', slashes * 2); result.Append('"'); return result.ToString();
  }
  public static int Run(string executable, string expectedHash, string[] arguments, string cancellationPath) {
    // Deny writes and replacement from the final fingerprint check through tree convergence.
    using (FileStream binary = new FileStream(executable, FileMode.Open, FileAccess.Read, FileShare.Read))
    using (SHA256 sha = SHA256.Create()) {
      string hash = BitConverter.ToString(sha.ComputeHash(binary)).Replace("-", "").ToLowerInvariant();
      if (hash != expectedHash) throw new InvalidOperationException("Prepared interpreter fingerprint changed");
      return RunLocked(executable, arguments, cancellationPath);
    }
  }
  static int RunLocked(string executable, string[] arguments, string cancellationPath) {
    if (File.Exists(cancellationPath)) return 1;
    IntPtr job = CreateJobObject(IntPtr.Zero, null); Check(job != IntPtr.Zero);
    ExtendedLimits limits = new ExtendedLimits(); limits.Basic.Flags = 0x2000; // KILL_ON_JOB_CLOSE
    Check(SetInformationJobObject(job, 9, ref limits, (uint)Marshal.SizeOf(typeof(ExtendedLimits))));
    IntPtr attributeSize = IntPtr.Zero;
    InitializeProcThreadAttributeList(IntPtr.Zero, 1, 0, ref attributeSize);
    StartupInfoEx startup = new StartupInfoEx();
    startup.Attributes = Marshal.AllocHGlobal(attributeSize);
    Check(InitializeProcThreadAttributeList(startup.Attributes, 1, 0, ref attributeSize));
    IntPtr jobs = Marshal.AllocHGlobal(IntPtr.Size); Marshal.WriteIntPtr(jobs, job);
    Check(UpdateProcThreadAttribute(startup.Attributes, 0, new IntPtr(0x0002000D), jobs, new IntPtr(IntPtr.Size), IntPtr.Zero, IntPtr.Zero));
    startup.Info.Size = Marshal.SizeOf(typeof(StartupInfoEx)); startup.Info.Flags = 0x100;
    startup.Info.Stdin = GetStdHandle(-10); startup.Info.Stdout = GetStdHandle(-11); startup.Info.Stderr = GetStdHandle(-12);
    Check(SetHandleInformation(startup.Info.Stdin, 1, 1)); Check(SetHandleInformation(startup.Info.Stdout, 1, 1)); Check(SetHandleInformation(startup.Info.Stderr, 1, 1));
    StringBuilder command = new StringBuilder(Quote(executable));
    foreach (string argument in arguments) command.Append(" ").Append(Quote(argument));
    ProcessInfo process;
    Check(CreateProcess(executable, command, IntPtr.Zero, IntPtr.Zero, true, 0x00080000 | 0x08000000, IntPtr.Zero, null, ref startup, out process));
    CloseHandle(process.Thread); DeleteProcThreadAttributeList(startup.Attributes);
    Marshal.FreeHGlobal(startup.Attributes); Marshal.FreeHGlobal(jobs);
    uint code = 1;
    while (!File.Exists(cancellationPath)) {
      uint waited = WaitForSingleObject(process.Process, 20);
      if (waited == 0) { Check(GetExitCodeProcess(process.Process, out code)); break; }
      if (waited != 258) throw new Win32Exception(Marshal.GetLastWin32Error());
    }
    CloseHandle(process.Process);
    Check(TerminateJobObject(job, 1));
    Accounting accounting;
    for (int i = 0; i < 500; i++) {
      Check(QueryInformationJobObject(job, 1, out accounting, (uint)Marshal.SizeOf(typeof(Accounting)), IntPtr.Zero));
      if (accounting.ActiveProcesses == 0) { CloseHandle(job); return unchecked((int)code); }
      Thread.Sleep(10);
    }
    CloseHandle(job); throw new InvalidOperationException("Script process job did not converge");
  }
}
'@
$nativeArguments = [string[]](Get-Content -LiteralPath $ArgumentsPath -Raw -Encoding UTF8 | ConvertFrom-Json)
# Only Add-Type uses the short compiler scratch directory. Actual children keep attempt isolation.
$env:TEMP = $ChildTemp
$env:TMP = $ChildTemp
exit [OrdineScriptJob]::Run($Executable, $ExecutableSha256, $nativeArguments, $CancellationPath)
