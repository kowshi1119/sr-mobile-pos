# Real Windows mouse/keyboard input for desktop QA (SendInput -> genuine WM_KEYDOWN/WM_CHAR).
# Reads one command per line on stdin and answers "ok ..." or "err ...".
#   target <hwnd>            only ever send input while this window is in the foreground
#   click <x> <y>            left click at physical screen pixels
#   dblclick <x> <y>
#   wheel <x> <y> <delta>
#   text <base64-utf8>       type text as unicode key presses
#   key <VK> [ctrl|shift|alt ...]   press one virtual key with modifiers
#   fg                       report whether the target window is in the foreground
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class QaInput {
  [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx, dy; public uint mouseData, dwFlags, time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk, wScan; public uint dwFlags, time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Explicit)] public struct UNION { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public UNION u; }
  [DllImport("user32.dll")] public static extern uint SendInput(uint n, INPUT[] inputs, int size);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h, uint flags);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  static void Send(INPUT i) { SendInput(1, new[] { i }, Marshal.SizeOf(typeof(INPUT))); }
  public static void Mouse(uint flags, uint data) { var i = new INPUT { type = 0 }; i.u.mi.dwFlags = flags; i.u.mi.mouseData = data; Send(i); }
  public static void Key(ushort vk, ushort scan, uint flags) { var i = new INPUT { type = 1 }; i.u.ki.wVk = vk; i.u.ki.wScan = scan; i.u.ki.dwFlags = flags; Send(i); }
}
'@
[QaInput]::SetProcessDPIAware() | Out-Null
$target = [IntPtr]::Zero
function Foreground { if ($target -eq [IntPtr]::Zero) { return $false }; $fg = [QaInput]::GetForegroundWindow(); return ([QaInput]::GetAncestor($fg, 3) -eq $target) -or ($fg -eq $target) }
# Waits briefly for window activation to settle before refusing input.
function Guard { for ($i = 0; $i -lt 40; $i++) { if (Foreground) { return }; Start-Sleep -Milliseconds 50 }; throw 'target window is not in the foreground; input refused' }
# Windows only lets a process take the foreground right after keyboard input, so tap Alt first.
function Activate { [QaInput]::Key(0x12, 0, 0); [QaInput]::Key(0x12, 0, 0x0002); [QaInput]::BringWindowToTop($target) | Out-Null; [QaInput]::SetForegroundWindow($target) | Out-Null }
function Click([int]$x, [int]$y) { [QaInput]::SetCursorPos($x, $y) | Out-Null; Start-Sleep -Milliseconds 40; [QaInput]::Mouse(0x0002, 0); [QaInput]::Mouse(0x0004, 0) }
$mods = @{ ctrl = 0x11; shift = 0x10; alt = 0x12 }
while ($null -ne ($line = [Console]::In.ReadLine())) {
  try {
    $p = $line.Split(' ')
    switch ($p[0]) {
      'target' { $target = [IntPtr][Int64]$p[1]; 'ok' }
      'activate' { Activate; Guard; 'ok' }
      'fg' { $fg = [QaInput]::GetForegroundWindow(); "ok $(Foreground) fg=$fg root=$([QaInput]::GetAncestor($fg, 3)) target=$target" }
      'click' { Click $p[1] $p[2]; 'ok' }
      'dblclick' { Click $p[1] $p[2]; Start-Sleep -Milliseconds 60; [QaInput]::Mouse(0x0002, 0); [QaInput]::Mouse(0x0004, 0); 'ok' }
      'wheel' { [QaInput]::SetCursorPos([int]$p[1], [int]$p[2]) | Out-Null; Guard; [QaInput]::Mouse(0x0800, [uint32]([int]$p[3] -band 0xFFFFFFFF)); 'ok' }
      'text' {
        Guard
        $s = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($p[1]))
        foreach ($c in $s.ToCharArray()) { [QaInput]::Key(0, [uint16]$c, 0x0004); [QaInput]::Key(0, [uint16]$c, 0x0006); Start-Sleep -Milliseconds 12 }
        'ok'
      }
      'key' {
        Guard
        $vk = [uint16]$p[1]; $held = @($p | Select-Object -Skip 2 | ForEach-Object { $mods[$_] })
        foreach ($m in $held) { [QaInput]::Key($m, 0, 0) }
        [QaInput]::Key($vk, 0, 0); [QaInput]::Key($vk, 0, 0x0002)
        [array]::Reverse($held); foreach ($m in $held) { [QaInput]::Key($m, 0, 0x0002) }
        'ok'
      }
      default { "err unknown $($p[0])" }
    }
  } catch { "err $($_.Exception.Message)" }
}
