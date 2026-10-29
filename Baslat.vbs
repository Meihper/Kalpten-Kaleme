Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
appDir = fso.GetParentFolderName(WScript.ScriptFullName)
psCmd = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & appDir & "\server.ps1"""
If WScript.Arguments.Count > 0 Then
    psCmd = psCmd & " -FilePath """ & WScript.Arguments(0) & """"
End If
sh.Run psCmd, 0, False
