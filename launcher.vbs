Set WshShell = CreateObject("WScript.Shell")
Set WshArgs = WScript.Arguments
Dim currentDir, filePath
currentDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)

If WshArgs.Count > 0 Then
    filePath = WshArgs(0)
    WshShell.Run "powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File """ & currentDir & "\server.ps1"" -FilePath """ & filePath & """", 0, False
Else
    WshShell.Run "powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File """ & currentDir & "\server.ps1""", 0, False
End If
