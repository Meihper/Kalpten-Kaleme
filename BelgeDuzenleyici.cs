using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace BelgeDuzenleyici
{
    public static class Program
    {
        private const int DefaultPort = 52480;
        private static int activePort = DefaultPort;
        public static string CustomAppDir = null;
        private static string appDir;
        private static string currentFilePath = null;
        private static HttpListener listener = null;
        private static volatile bool isRunning = true;
        private static volatile bool isHeadlessDaemon = false;
        private static volatile bool hasReceivedHeartbeat = false;
        private static DateTime lastHeartbeat = DateTime.UtcNow;

        private static readonly Dictionary<string, string> MimeTypes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { ".html", "text/html; charset=utf-8" },
            { ".htm", "text/html; charset=utf-8" },
            { ".css", "text/css; charset=utf-8" },
            { ".js", "application/javascript; charset=utf-8" },
            { ".json", "application/json; charset=utf-8" },
            { ".png", "image/png" },
            { ".ico", "image/x-icon" },
            { ".jpg", "image/jpeg" },
            { ".jpeg", "image/jpeg" },
            { ".svg", "image/svg+xml" },
            { ".pdf", "application/pdf" },
            { ".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
            { ".pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
            { ".ppt", "application/vnd.ms-powerpoint" },
            { ".txt", "text/plain; charset=utf-8" },
            { ".woff", "font/woff" },
            { ".woff2", "font/woff2" },
            { ".ttf", "font/ttf" }
        };

        private class CachedFile
        {
            public byte[] Bytes;
            public DateTime LastWrite;
        }

        // In-memory cache with automatic disk modification detection
        private static readonly Dictionary<string, CachedFile> FileCache = new Dictionary<string, CachedFile>(StringComparer.OrdinalIgnoreCase);

        // Win32 APIs for Native Window Icon and Process Window Association
        [DllImport("user32.dll", SetLastError = true)]
        private static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
        private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
        private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        private static extern IntPtr LoadImage(IntPtr hinst, string lpszName, uint uType, int cxDesired, int cyDesired, uint fuLoad);

        private const uint WM_SETICON = 0x0080;
        private static readonly IntPtr ICON_SMALL = (IntPtr)0;
        private static readonly IntPtr ICON_BIG = (IntPtr)1;
        private const uint IMAGE_ICON = 1;
        private const uint LR_LOADFROMFILE = 0x00000010;

        [STAThread]
        public static void Main(string[] args)
        {
            appDir = !string.IsNullOrEmpty(CustomAppDir) ? CustomAppDir : AppDomain.CurrentDomain.BaseDirectory;
            string targetFileToOpen = null;
            bool headlessServer = false;

            if (args != null && args.Length > 0)
            {
                foreach (var a in args)
                {
                    if (string.Equals(a, "--headless-server", StringComparison.OrdinalIgnoreCase))
                    {
                        headlessServer = true;
                        isHeadlessDaemon = true;
                    }
                }
                if (!headlessServer)
                {
                    string combined = string.Join(" ", args).Trim('"', '\'');
                    if (File.Exists(combined))
                    {
                        targetFileToOpen = Path.GetFullPath(combined);
                    }
                    else
                    {
                        string first = args[0].Trim('"', '\'');
                        if (File.Exists(first))
                        {
                            targetFileToOpen = Path.GetFullPath(first);
                        }
                    }
                }
            }

            // 1. Instant check if application server is already active on DefaultPort (Zero network delay)
            if (IsServerActive(DefaultPort))
            {
                if (!string.IsNullOrEmpty(targetFileToOpen))
                {
                    NotifyRunningInstance(DefaultPort, targetFileToOpen);
                }
                if (!headlessServer)
                {
                    LaunchBrowserWindow(DefaultPort);
                }
                return;
            }

            currentFilePath = targetFileToOpen;

            // 2. Pre-cache essential static assets into RAM for instant response
            WarmUpCache();

            // 3. Start Built-in HTTP Server
            bool started = StartHttpServer();
            if (!started)
            {
                if (!headlessServer)
                {
                    string localFile = Path.Combine(appDir, "index.html");
                    try { Process.Start(localFile); } catch {}
                }
                return;
            }

            if (!headlessServer)
            {
                // 4. Launch Browser in High-Speed Native App Mode
                LaunchBrowserWindow(activePort);

                // 5. Background Thread to set native Win32 icons on the Edge/Chrome window
                StartWindowIconEnforcer();
            }

            // 6. Keep alive while Browser window is active (or indefinitely in --headless-server daemon mode)
            DateTime startTime = DateTime.UtcNow;
            while (isRunning)
            {
                Thread.Sleep(1000);
                if (headlessServer) continue;

                if (!hasReceivedHeartbeat)
                {
                    if ((DateTime.UtcNow - startTime).TotalSeconds > 45)
                    {
                        break;
                    }
                }
                else
                {
                    if ((DateTime.UtcNow - lastHeartbeat).TotalSeconds > 40)
                    {
                        break;
                    }
                }
            }

            // 7. Clean shutdown
            isRunning = false;
            try
            {
                if (listener != null)
                {
                    listener.Stop();
                    listener.Close();
                }
            }
            catch {}
        }

        private static void WarmUpCache()
        {
            string[] coreFiles = new string[] { "index.html", "styles.css", "app.js", "word-editor.js", "ppt-editor.js", "pdf-editor.js", "pdf-tools.js", "manifest.json", "favicon.ico", "app.png" };
            foreach (var f in coreFiles)
            {
                try
                {
                    string p = Path.Combine(appDir, f);
                    if (File.Exists(p))
                    {
                        FileCache[f.ToLower()] = new CachedFile { Bytes = File.ReadAllBytes(p), LastWrite = File.GetLastWriteTimeUtc(p) };
                    }
                }
                catch {}
            }
        }

        private static bool StartHttpServer()
        {
            int[] candidatePorts = new int[] { DefaultPort, 52481, 52482, 52483 };
            foreach (int port in candidatePorts)
            {
                try
                {
                    var l = new HttpListener();
                    l.Prefixes.Add("http://localhost:" + port + "/");
                    l.Start();
                    listener = l;
                    activePort = port;

                    Thread serverThread = new Thread(RunServerLoop)
                    {
                        IsBackground = true
                    };
                    serverThread.Start();
                    return true;
                }
                catch
                {
                    // Port in use, continue
                }
            }
            return false;
        }

        // Instant 0ms check without hanging on HttpWebRequest timeouts
        private static bool IsServerActive(int port)
        {
            try
            {
                var ipProps = IPGlobalProperties.GetIPGlobalProperties();
                var listeners = ipProps.GetActiveTcpListeners();
                for (int i = 0; i < listeners.Length; i++)
                {
                    if (listeners[i].Port == port) return true;
                }
            }
            catch {}
            return false;
        }

        private static void NotifyRunningInstance(int port, string filePath)
        {
            try
            {
                var req = (HttpWebRequest)WebRequest.Create("http://localhost:" + port + "/api/open-file");
                req.Method = "POST";
                req.Timeout = 1200;
                byte[] data = Encoding.UTF8.GetBytes(filePath);
                req.ContentType = "text/plain; charset=utf-8";
                req.ContentLength = data.Length;
                using (var stream = req.GetRequestStream())
                {
                    stream.Write(data, 0, data.Length);
                }
                using (var resp = req.GetResponse()) {}
            }
            catch {}
        }

        // ========================================================================
        // Google Drive / Sync Folder Detection & Management
        // ========================================================================
        private static string cachedSyncFolder = null;

        public static string GetSyncFolder()
        {
            if (!string.IsNullOrEmpty(cachedSyncFolder) && Directory.Exists(cachedSyncFolder))
            {
                return cachedSyncFolder;
            }

            string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            string configFile = Path.Combine(appDir, "config.json");
            if (File.Exists(configFile))
            {
                try
                {
                    string json = File.ReadAllText(configFile, Encoding.UTF8);
                    int idx = json.IndexOf("\"syncFolder\"", StringComparison.OrdinalIgnoreCase);
                    if (idx >= 0)
                    {
                        int colon = json.IndexOf(':', idx);
                        if (colon >= 0)
                        {
                            int q1 = json.IndexOf('"', colon);
                            if (q1 >= 0)
                            {
                                int q2 = json.IndexOf('"', q1 + 1);
                                if (q2 > q1)
                                {
                                    string folder = json.Substring(q1 + 1, q2 - q1 - 1).Replace("\\\\", "\\");
                                    if (!string.IsNullOrEmpty(folder))
                                    {
                                        // Portability & Cloud-Upgrade check:
                                        // 1) If config.json came from another PC's C:\Users\<other>, ignore it and auto-detect.
                                        // 2) If config.json was pointing to the local MyDocuments fallback ("local") while OneDrive/Google Drive exists, upgrade to Cloud!
                                        bool isForeignUserPath = folder.StartsWith("C:\\Users\\", StringComparison.OrdinalIgnoreCase) &&
                                                                 !folder.StartsWith(userProfile, StringComparison.OrdinalIgnoreCase);
                                        string defaultLocalFallback = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "Kalpten Kaleme");
                                        bool isDefaultLocalFallback = string.Equals(folder.TrimEnd('\\'), defaultLocalFallback.TrimEnd('\\'), StringComparison.OrdinalIgnoreCase);
                                        string parentDir = Path.GetDirectoryName(folder);
                                        if (!isForeignUserPath && !isDefaultLocalFallback && (Directory.Exists(folder) || (!string.IsNullOrEmpty(parentDir) && Directory.Exists(parentDir))))
                                        {
                                            if (!Directory.Exists(folder))
                                            {
                                                Directory.CreateDirectory(folder);
                                            }
                                            cachedSyncFolder = folder;
                                            return folder;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                catch {}
            }

            // Auto-detect standard Google Drive & OneDrive Desktop locations on any PC
            var candidateList = new List<string>
            {
                @"G:\My Drive\Kalpten Kaleme",
                @"G:\Drive'ım\Kalpten Kaleme",
                @"G:\Kalpten Kaleme",
                Path.Combine(userProfile, "Google Drive", "Kalpten Kaleme"),
                Path.Combine(userProfile, "Google Drive'ım", "Kalpten Kaleme"),
                Path.Combine(userProfile, "GoogleDrive", "Kalpten Kaleme")
            };
            string envOneDrive = Environment.GetEnvironmentVariable("OneDrive");
            if (!string.IsNullOrEmpty(envOneDrive)) candidateList.Add(Path.Combine(envOneDrive, "Kalpten Kaleme"));
            string envOneDriveConsumer = Environment.GetEnvironmentVariable("OneDriveConsumer");
            if (!string.IsNullOrEmpty(envOneDriveConsumer)) candidateList.Add(Path.Combine(envOneDriveConsumer, "Kalpten Kaleme"));
            candidateList.Add(Path.Combine(userProfile, "OneDrive", "Kalpten Kaleme"));
            candidateList.Add(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "Kalpten Kaleme"));

            string[] candidates = candidateList.ToArray();

            foreach (string path in candidates)
            {
                string parent = Path.GetDirectoryName(path);
                if (Directory.Exists(parent) || path.StartsWith("G:\\", StringComparison.OrdinalIgnoreCase))
                {
                    try
                    {
                        if (!Directory.Exists(path))
                        {
                            Directory.CreateDirectory(path);
                        }
                        cachedSyncFolder = path;
                        SaveSyncFolderConfig(path);
                        return path;
                    }
                    catch {}
                }
            }

            string fallback = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "Kalpten Kaleme");
            try
            {
                if (!Directory.Exists(fallback)) Directory.CreateDirectory(fallback);
            }
            catch {}
            cachedSyncFolder = fallback;
            SaveSyncFolderConfig(fallback);
            return fallback;
        }

        public static void SaveSyncFolderConfig(string path)
        {
            try
            {
                string configFile = Path.Combine(appDir, "config.json");
                string json = string.Format("{{\"syncFolder\":\"{0}\"}}", path.Replace("\\", "\\\\").Replace("\"", "\\\""));
                File.WriteAllText(configFile, json, Encoding.UTF8);
                cachedSyncFolder = path;
            }
            catch {}
        }

        public static string GetCloudProvider(string path)
        {
            if (string.IsNullOrEmpty(path)) return "local";
            string lower = path.ToLower();
            if (lower.StartsWith("g:\\") || lower.Contains("google drive") || lower.Contains("drive'ım") || lower.Contains("googledrive"))
                return "gdrive";
            if (lower.Contains("onedrive"))
                return "onedrive";
            if (lower.Contains("dropbox"))
                return "dropbox";
            return "local";
        }

        public static bool IsPathGoogleDrive(string path)
        {
            return GetCloudProvider(path) == "gdrive";
        }

        public static bool IsPathCloudSync(string path)
        {
            return GetCloudProvider(path) != "local";
        }

        private static void LaunchBrowserWindow(int port)
        {
            string[] browserPaths = new string[]
            {
                @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                @"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Microsoft\Edge\Application\msedge.exe"),
                @"C:\Program Files\Google\Chrome\Application\chrome.exe",
                @"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Google\Chrome\Application\chrome.exe")
            };

            string browserExe = null;
            foreach (var p in browserPaths)
            {
                if (File.Exists(p))
                {
                    browserExe = p;
                    break;
                }
            }

            if (string.IsNullOrEmpty(browserExe))
            {
                string[] appPathKeys = new string[]
                {
                    @"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe",
                    @"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe",
                    @"HKEY_CURRENT_USER\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe",
                    @"HKEY_CURRENT_USER\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe"
                };

                foreach (var k in appPathKeys)
                {
                    try
                    {
                        object val = Microsoft.Win32.Registry.GetValue(k, "", null);
                        if (val != null)
                        {
                            string regPath = val.ToString().Trim('"', ' ');
                            if (File.Exists(regPath))
                            {
                                browserExe = regPath;
                                break;
                            }
                        }
                    }
                    catch {}
                }
            }

            string appUrl = "http://localhost:" + port + "/index.html";
            string profileDir = Path.Combine(appDir, "profile");

            // Ensure profile suppresses first-run sync dialogs and welcome pages instantly
            try
            {
                if (!Directory.Exists(profileDir))
                {
                    Directory.CreateDirectory(profileDir);
                }
                string firstRunFile = Path.Combine(profileDir, "First Run");
                if (!File.Exists(firstRunFile))
                {
                    File.WriteAllText(firstRunFile, "");
                }
                string defaultDir = Path.Combine(profileDir, "Default");
                if (!Directory.Exists(defaultDir))
                {
                    Directory.CreateDirectory(defaultDir);
                }
                string prefFile = Path.Combine(defaultDir, "Preferences");
                if (!File.Exists(prefFile))
                {
                    File.WriteAllText(prefFile, "{\"browser\":{\"has_seen_welcome_page\":true},\"signin\":{\"allowed\":false},\"sync\":{\"has_setup_completed\":true}}");
                }
            }
            catch {}

            if (!string.IsNullOrEmpty(browserExe))
            {
                try
                {
                    string args = string.Format(
                        "--app={0} --user-data-dir=\"{1}\" --app-id=KalptenKaleme --app-name=\"Kalpten Kaleme\" --class=KalptenKaleme --no-first-run --no-default-browser-check --disable-sync --disable-features=Translate,msEdgeAutoSignIn,msEdgeFirstRunExperience,msEdgeFreV2,msEdgeSyncNotice,msEdgeShowFirstRunNotification,msEdgeSignInOptIn,msHub,msEdgeSidebarV2,msEdgeHub --disable-component-update --disable-background-networking --disable-extensions --hide-scrollbars --window-size=1280,840",
                        appUrl, profileDir
                    );

                    var psi = new ProcessStartInfo
                    {
                        FileName = browserExe,
                        Arguments = args,
                        UseShellExecute = false
                    };
                    Process.Start(psi);
                    return;
                }
                catch {}
            }

            // Fallback
            try { Process.Start(appUrl); } catch {}
        }

        private static void StartWindowIconEnforcer()
        {
            Thread t = new Thread(() =>
            {
                string iconPath = Path.Combine(appDir, "BelgeDuzenleyici.ico");
                if (!File.Exists(iconPath)) iconPath = Path.Combine(appDir, "kk_lux_app.ico");
                if (!File.Exists(iconPath)) return;

                IntPtr hIconBig = LoadImage(IntPtr.Zero, iconPath, IMAGE_ICON, 32, 32, LR_LOADFROMFILE);
                IntPtr hIconSmall = LoadImage(IntPtr.Zero, iconPath, IMAGE_ICON, 16, 16, LR_LOADFROMFILE);

                if (hIconBig == IntPtr.Zero && hIconSmall == IntPtr.Zero) return;

                // Try setting icon for 6 seconds as window appears
                for (int iter = 0; iter < 12; iter++)
                {
                    Thread.Sleep(500);
                    EnumWindows((hWnd, lParam) =>
                    {
                        var sb = new StringBuilder(256);
                        GetWindowText(hWnd, sb, 256);
                        string title = sb.ToString();

                        if (!string.IsNullOrEmpty(title) && title.IndexOf("Kalpten Kaleme", StringComparison.OrdinalIgnoreCase) >= 0)
                        {
                            if (hIconSmall != IntPtr.Zero)
                                SendMessage(hWnd, WM_SETICON, ICON_SMALL, hIconSmall);
                            if (hIconBig != IntPtr.Zero)
                                SendMessage(hWnd, WM_SETICON, ICON_BIG, hIconBig);
                        }
                        return true;
                    }, IntPtr.Zero);
                }
            })
            {
                IsBackground = true
            };
            t.Start();
        }

        private static void RunServerLoop()
        {
            while (isRunning && listener != null && listener.IsListening)
            {
                try
                {
                    var context = listener.GetContext();
                    ThreadPool.QueueUserWorkItem((c) => HandleRequest((HttpListenerContext)c), context);
                }
                catch
                {
                    if (!isRunning) break;
                }
            }
        }

        private static void HandleRequest(HttpListenerContext context)
        {
            var req = context.Request;
            var res = context.Response;

            lastHeartbeat = DateTime.UtcNow;
            hasReceivedHeartbeat = true;

            res.Headers.Add("Access-Control-Allow-Origin", "*");
            res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            res.Headers.Add("Access-Control-Allow-Headers", "Content-Type");

            if (req.HttpMethod == "OPTIONS")
            {
                res.StatusCode = 200;
                res.Close();
                return;
            }

            string rawUrl = req.Url.AbsolutePath;

            try
            {
                byte[] respBytes = null;

                if (rawUrl == "/api/ping")
                {
                    byte[] pong = Encoding.UTF8.GetBytes("pong");
                    res.ContentType = "text/plain";
                    res.StatusCode = 200;
                    res.OutputStream.Write(pong, 0, pong.Length);
                    res.Close();
                    return;
                }

                if (rawUrl == "/api/heartbeat")
                {
                    byte[] ok = Encoding.UTF8.GetBytes("ok");
                    res.ContentType = "text/plain";
                    res.StatusCode = 200;
                    res.OutputStream.Write(ok, 0, ok.Length);
                    res.Close();
                    return;
                }

                if (rawUrl == "/api/exit")
                {
                    byte[] bye = Encoding.UTF8.GetBytes("bye");
                    res.ContentType = "text/plain";
                    res.StatusCode = 200;
                    res.OutputStream.Write(bye, 0, bye.Length);
                    res.Close();
                    if (!isHeadlessDaemon)
                    {
                        isRunning = false;
                    }
                    return;
                }

                if (rawUrl == "/api/opened-file-info")
                {
                    string json;
                    if (!string.IsNullOrEmpty(currentFilePath) && File.Exists(currentFilePath))
                    {
                        string fn = Path.GetFileName(currentFilePath);
                        string ext = Path.GetExtension(currentFilePath).TrimStart('.').ToLower();
                        json = string.Format("{{\"hasFile\":true,\"filename\":\"{0}\",\"ext\":\"{1}\"}}", 
                            fn.Replace("\\", "\\\\").Replace("\"", "\\\""), ext);
                    }
                    else
                    {
                        json = "{\"hasFile\":false}";
                    }

                    respBytes = Encoding.UTF8.GetBytes(json);
                    res.ContentType = "application/json; charset=utf-8";
                    res.StatusCode = 200;
                    res.OutputStream.Write(respBytes, 0, respBytes.Length);
                    res.Close();
                    return;
                }

                if (rawUrl == "/api/opened-file-data")
                {
                    if (!string.IsNullOrEmpty(currentFilePath) && File.Exists(currentFilePath))
                    {
                        byte[] fileBytes = File.ReadAllBytes(currentFilePath);
                        string ext = Path.GetExtension(currentFilePath);
                        string mime = MimeTypes.ContainsKey(ext) ? MimeTypes[ext] : "application/octet-stream";
                        res.ContentType = mime;
                        res.ContentLength64 = fileBytes.Length;
                        res.StatusCode = 200;
                        res.OutputStream.Write(fileBytes, 0, fileBytes.Length);
                        res.Close();
                        return;
                    }
                    else
                    {
                        res.StatusCode = 404;
                        res.Close();
                        return;
                    }
                }

                if (rawUrl == "/api/open-file" && req.HttpMethod == "POST")
                {
                    using (var reader = new StreamReader(req.InputStream, Encoding.UTF8))
                    {
                        string path = reader.ReadToEnd().Trim();
                        if (File.Exists(path))
                        {
                            currentFilePath = path;
                        }
                    }
                    res.StatusCode = 200;
                    res.Close();
                    return;
                }

                if (rawUrl == "/api/drive-status")
                {
                    string folder = GetSyncFolder();
                    string provider = GetCloudProvider(folder);
                    bool isGDrive = (provider == "gdrive");
                    bool isCloud = (provider != "local");
                    bool exists = Directory.Exists(folder);
                    string json = string.Format("{{\"syncFolder\":\"{0}\",\"isGoogleDrive\":{1},\"isCloudSync\":{2},\"cloudProvider\":\"{3}\",\"exists\":{4}}}",
                        folder.Replace("\\", "\\\\").Replace("\"", "\\\""),
                        isGDrive ? "true" : "false",
                        isCloud ? "true" : "false",
                        provider,
                        exists ? "true" : "false");
                    respBytes = Encoding.UTF8.GetBytes(json);
                    res.ContentType = "application/json; charset=utf-8";
                    res.StatusCode = 200;
                    res.OutputStream.Write(respBytes, 0, respBytes.Length);
                    res.Close();
                    return;
                }

                if (rawUrl == "/api/save-document" && req.HttpMethod == "POST")
                {
                    string filename = req.QueryString["filename"];
                    if (string.IsNullOrEmpty(filename)) filename = "Yeni Yazı.docx";
                    string fExt = Path.GetExtension(filename).ToLower();
                    if (fExt != ".docx" && fExt != ".pdf" && fExt != ".pptx" && fExt != ".ppt" && fExt != ".json") filename += ".docx";

                    string targetFolder = GetSyncFolder();
                    if (!Directory.Exists(targetFolder)) Directory.CreateDirectory(targetFolder);

                    string savePath = Path.Combine(targetFolder, filename);

                    using (var fs = new FileStream(savePath, FileMode.Create, FileAccess.Write))
                    {
                        byte[] buffer = new byte[8192];
                        int bytesRead;
                        while ((bytesRead = req.InputStream.Read(buffer, 0, buffer.Length)) > 0)
                        {
                            fs.Write(buffer, 0, bytesRead);
                        }
                    }

                    currentFilePath = savePath;
                    string timeStr = DateTime.Now.ToString("HH:mm");
                    string provider = GetCloudProvider(targetFolder);
                    bool isGDrive = (provider == "gdrive");
                    bool isCloud = (provider != "local");

                    string json = string.Format(
                        "{{\"success\":true,\"path\":\"{0}\",\"filename\":\"{1}\",\"time\":\"{2}\",\"isGoogleDrive\":{3},\"isCloudSync\":{4},\"cloudProvider\":\"{5}\"}}",
                        savePath.Replace("\\", "\\\\").Replace("\"", "\\\""),
                        filename.Replace("\\", "\\\\").Replace("\"", "\\\""),
                        timeStr,
                        isGDrive ? "true" : "false",
                        isCloud ? "true" : "false",
                        provider
                    );
                    respBytes = Encoding.UTF8.GetBytes(json);
                    res.ContentType = "application/json; charset=utf-8";
                    res.StatusCode = 200;
                    res.OutputStream.Write(respBytes, 0, respBytes.Length);
                    res.Close();
                    return;
                }

                if (rawUrl == "/api/drive-files")
                {
                    string folder = GetSyncFolder();
                    var fileList = new List<string>();

                    if (Directory.Exists(folder))
                    {
                        var dirInfo = new DirectoryInfo(folder);
                        var files = dirInfo.GetFiles("*.*", SearchOption.TopDirectoryOnly);
                        Array.Sort(files, (x, y) => y.LastWriteTimeUtc.CompareTo(x.LastWriteTimeUtc));

                        foreach (var fi in files)
                        {
                            string ext = fi.Extension.ToLower();
                            if (ext == ".docx" || ext == ".doc" || ext == ".txt" || ext == ".pdf" || ext == ".pptx" || ext == ".ppt" || ext == ".json")
                            {
                                string sizeStr;
                                if (fi.Length > 1024 * 1024)
                                    sizeStr = string.Format("{0:0.#} MB", fi.Length / (1024f * 1024f));
                                else
                                    sizeStr = string.Format("{0} KB", Math.Max(1, fi.Length / 1024));

                                string dateStr = fi.LastWriteTime.ToString("dd.MM.yyyy HH:mm");
                                string itemJson = string.Format(
                                    "{{\"name\":\"{0}\",\"path\":\"{1}\",\"size\":\"{2}\",\"date\":\"{3}\",\"ext\":\"{4}\"}}",
                                    fi.Name.Replace("\\", "\\\\").Replace("\"", "\\\""),
                                    fi.FullName.Replace("\\", "\\\\").Replace("\"", "\\\""),
                                    sizeStr,
                                    dateStr,
                                    ext.TrimStart('.')
                                );
                                fileList.Add(itemJson);
                            }
                        }
                    }

                    string json = "[" + string.Join(",", fileList.ToArray()) + "]";
                    respBytes = Encoding.UTF8.GetBytes(json);
                    res.ContentType = "application/json; charset=utf-8";
                    res.StatusCode = 200;
                    res.OutputStream.Write(respBytes, 0, respBytes.Length);
                    res.Close();
                    return;
                }

                if (rawUrl == "/api/open-sync-folder")
                {
                    string folder = GetSyncFolder();
                    if (Directory.Exists(folder))
                    {
                        try { Process.Start("explorer.exe", "\"" + folder + "\""); } catch {}
                    }
                    respBytes = Encoding.UTF8.GetBytes("{\"success\":true}");
                    res.ContentType = "application/json; charset=utf-8";
                    res.StatusCode = 200;
                    res.OutputStream.Write(respBytes, 0, respBytes.Length);
                    res.Close();
                    return;
                }

                if (rawUrl == "/api/select-sync-folder")
                {
                    string selected = null;
                    Thread staThread = new Thread(() =>
                    {
                        try
                        {
                            using (var fbd = new FolderBrowserDialog())
                            {
                                fbd.Description = "Kalpten Kaleme - Google Drive veya Yazı Klasörünü Seçin";
                                fbd.ShowNewFolderButton = true;
                                string cur = GetSyncFolder();
                                if (Directory.Exists(cur)) fbd.SelectedPath = cur;
                                if (fbd.ShowDialog() == DialogResult.OK)
                                {
                                    selected = fbd.SelectedPath;
                                }
                            }
                        }
                        catch {}
                    });
                    staThread.SetApartmentState(ApartmentState.STA);
                    staThread.Start();
                    staThread.Join(60000);

                    if (!string.IsNullOrEmpty(selected) && Directory.Exists(selected))
                    {
                        SaveSyncFolderConfig(selected);
                    }

                    string currentFolder = GetSyncFolder();
                    bool isGDrive = IsPathGoogleDrive(currentFolder);
                    string json = string.Format("{{\"syncFolder\":\"{0}\",\"isGoogleDrive\":{1}}}",
                        currentFolder.Replace("\\", "\\\\").Replace("\"", "\\\""),
                        isGDrive ? "true" : "false");

                    respBytes = Encoding.UTF8.GetBytes(json);
                    res.ContentType = "application/json; charset=utf-8";
                    res.StatusCode = 200;
                    res.OutputStream.Write(respBytes, 0, respBytes.Length);
                    res.Close();
                    return;
                }

                if (rawUrl == "/api/open-specific-file" && req.HttpMethod == "POST")
                {
                    using (var reader = new StreamReader(req.InputStream, Encoding.UTF8))
                    {
                        string path = reader.ReadToEnd().Trim();
                        if (File.Exists(path))
                        {
                            currentFilePath = path;
                        }
                    }
                    respBytes = Encoding.UTF8.GetBytes("{\"success\":true}");
                    res.ContentType = "application/json; charset=utf-8";
                    res.StatusCode = 200;
                    res.OutputStream.Write(respBytes, 0, respBytes.Length);
                    res.Close();
                    return;
                }

                // Serve static files with RAM cache and auto-invalidation
                string relPath = rawUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
                if (string.IsNullOrEmpty(relPath)) relPath = "index.html";

                string cacheKey = relPath.ToLower();
                byte[] content = null;

                string filePath = Path.Combine(appDir, relPath);
                if (File.Exists(filePath))
                {
                    try
                    {
                        DateTime lastWrite = File.GetLastWriteTimeUtc(filePath);
                        CachedFile cached;
                        if (!FileCache.TryGetValue(cacheKey, out cached) || cached.LastWrite < lastWrite)
                        {
                            cached = new CachedFile { Bytes = File.ReadAllBytes(filePath), LastWrite = lastWrite };
                            FileCache[cacheKey] = cached;
                        }
                        content = cached.Bytes;
                    }
                    catch
                    {
                        if (FileCache.ContainsKey(cacheKey))
                        {
                            content = FileCache[cacheKey].Bytes;
                        }
                    }
                }

                if (content != null)
                {
                    string ext = Path.GetExtension(relPath);
                    string mime = MimeTypes.ContainsKey(ext) ? MimeTypes[ext] : "application/octet-stream";

                    res.ContentType = mime;
                    res.ContentLength64 = content.Length;
                    res.StatusCode = 200;
                    res.OutputStream.Write(content, 0, content.Length);
                    res.Close();
                }
                else
                {
                    res.StatusCode = 404;
                    res.Close();
                }
            }
            catch
            {
                try { res.StatusCode = 500; res.Close(); } catch {}
            }
        }
    }
}
