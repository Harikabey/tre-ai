import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveSharedFile, getSharedFiles, MAX_SHARED_FILE_SIZE } from "@/lib/shared-files";

interface FileLaunchQueue {
  setConsumer: (consumer: (params: { files?: Array<{ getFile: () => Promise<File> }> }) => void) => void;
}

type WindowWithLaunchQueue = Window & { launchQueue?: FileLaunchQueue };

const FileHandlerFeaturePreview = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    let receivedFile = false;
    const timeout = window.setTimeout(() => {
      if (active && !receivedFile) navigate("/", { replace: true });
    }, 2000);
    const launchQueue = (window as WindowWithLaunchQueue).launchQueue;

    launchQueue?.setConsumer((params) => {
      const handle = params.files?.[0];
      if (!handle) return;
      receivedFile = true;
      window.clearTimeout(timeout);
      void (async () => {
        try {
          const file = await handle.getFile();
          if (file.size > MAX_SHARED_FILE_SIZE) {
            toast.error("Dosya boyutu 10 MB sınırını aşıyor");
            navigate("/", { replace: true });
            return;
          }
          await saveSharedFile(file);
          if (active) navigate("/?shared=true", { replace: true });
        } catch (error) {
          console.error("Açılan dosya Tre'ye aktarılamadı.", error);
          toast.error("Dosya Tre'ye aktarılamadı");
          if (active) navigate("/", { replace: true });
        }
      })();
    });

    void getSharedFiles()
      .then((files) => {
        if (files.length > 0 && active) {
          receivedFile = true;
          window.clearTimeout(timeout);
          navigate("/?shared=true", { replace: true });
        } else if (!launchQueue && active) {
          window.clearTimeout(timeout);
          navigate("/", { replace: true });
        }
      })
      .catch((error: unknown) => {
        console.error("Paylaşılan dosyalar okunamadı.", error);
        toast.error("Paylaşılan dosya açılamadı");
        if (active) navigate("/", { replace: true });
      });

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <section className="flex min-h-[100dvh] w-full items-center justify-center px-4 text-center">
      <div className="flex flex-col items-center gap-3">
        <FileText className="h-8 w-8 text-primary" />
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Dosya Tre sohbetine aktarılıyor...</p>
      </div>
    </section>
  );
};

export default FileHandlerFeaturePreview;
