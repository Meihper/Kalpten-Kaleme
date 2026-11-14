Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
appDir = fso.GetParentFolderName(WScript.ScriptFullName)
psExe = sh.ExpandEnvironmentStrings("%SystemRoot%\SysNative\WindowsPowerShell\v1.0\powershell.exe")
If Not fso.FileExists(psExe) Then
    psExe = sh.ExpandEnvironmentStrings("%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe")
End If
targetScript = appDir & "\KalptenKaleme.ps1"
If Not fso.FileExists(targetScript) Then
    targetScript = appDir & "\server.ps1"
End If
psCmd = """" & psExe & """ -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & targetScript & """"
If WScript.Arguments.Count > 0 Then
    psCmd = psCmd & " -FilePath """ & Replace(WScript.Arguments(0), """", "") & """"
End If
sh.Run psCmd, 0, False
