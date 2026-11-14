Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")
Set WshArgs = WScript.Arguments
Dim currentDir, psExe, targetScript, cmdLine
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
psExe = WshShell.ExpandEnvironmentStrings("%SystemRoot%\SysNative\WindowsPowerShell\v1.0\powershell.exe")
If Not fso.FileExists(psExe) Then
    psExe = WshShell.ExpandEnvironmentStrings("%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe")
End If
targetScript = currentDir & "\KalptenKaleme.ps1"
If Not fso.FileExists(targetScript) Then
    targetScript = currentDir & "\server.ps1"
End If
cmdLine = """" & psExe & """ -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File """ & targetScript & """"
If WshArgs.Count > 0 Then
    cmdLine = cmdLine & " -FilePath """ & Replace(WshArgs(0), """", "") & """"
End If
WshShell.Run cmdLine, 0, False
