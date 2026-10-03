import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { inputClasses } from "@/components/ui/FormField";
import { useToast } from "@/features/ui/useToast";
import { API_BASE_URL } from "@/lib/env";
import { backgroundUploads } from "@/features/uploads/uploadService";
import { sha256 } from "@/lib/imports";

import { parseKaironFile, type KaironCsvParseResult } from "./kaironCsv";

// The template endpoint (backend/app/kairon/routes.py's KaironUploadTemplate)
// returns plain text/csv, not the {status,message,data} JSON envelope, so
// the backend's encryption hook skips it (encrypt_response_body only
// touches JSON responses) — a plain fetch outside RTK Query's encrypted
// baseQuery is the correct way to pull it, not a workaround.
async function downloadTemplate() {
  const response = await fetch(`${API_BASE_URL}/kairon/upload-template`, { credentials: "include" });
  if (!response.ok) throw new Error("Could not download the template.");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "kairon_upload_template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

interface KaironUploadFormPageProps {
  embedded?: boolean;
  onCancel?: () => void;
  onStarted?: () => void;
}

export function KaironUploadFormPage({ embedded = false, onCancel, onStarted }: KaironUploadFormPageProps = {}) {
  const navigate = useNavigate();
  const { notifyError } = useToast();
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileChecksum, setFileChecksum] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<KaironCsvParseResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const submitted = useRef(false);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setParseResult(null);
    setFileChecksum(null);
    setIsParsing(true);
    try {
      const contents = await file.arrayBuffer();
      const [result, checksum] = await Promise.all([parseKaironFile(file, contents), sha256(contents)]);
      setParseResult(result);
      setFileChecksum(checksum);
    } catch {
      notifyError("Could not read the Kairon file. Try selecting it again.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await downloadTemplate();
    } catch {
      notifyError("Could not download the template. Try again.");
    }
  };

  const canSubmit =
    Boolean(fileName && fileChecksum) &&
    parseResult !== null &&
    parseResult.fileErrors.length === 0 &&
    parseResult.rowErrors.length === 0 &&
    parseResult.rows.length > 0;

  const handleSubmit = () => {
    if (submitted.current || isParsing || !canSubmit || !parseResult || !fileName || !fileChecksum) return;
    submitted.current = true;
    backgroundUploads.start({ kind: "kairon", fileName, fileChecksum, rows: parseResult.rows });
    if (onStarted) onStarted();
    else navigate("/input-data");
  };

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {!embedded && (
        <div>
          <h1 className="text-lg font-semibold text-content-primary">Upload Kairon chart records</h1>
          <p className="text-sm text-content-muted">
            Upload a month-to-date or project-to-date Kairon CSV, ODS, XLS, or XLSX file. Patient names are removed in
            your browser; MBI is used only to prevent duplicate charts and is never stored as plain text.
          </p>
        </div>
      )}

      <div className={`flex flex-col gap-4 ${embedded ? "" : "rounded-lg border border-border bg-surface p-6"}`}>
        <div>
          <Button type="button" variant="secondary" onClick={() => void handleDownloadTemplate()}>
            Download reference template
          </Button>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-content-secondary" htmlFor="kaironFile">
            Filled-in Kairon file
          </label>
          <input
            id="kaironFile"
            type="file"
            accept=".csv,.ods,.xls,.xlsx,text/csv,application/vnd.oasis.opendocument.spreadsheet,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className={inputClasses}
            disabled={isParsing}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </div>

        {isParsing && fileName && (
          <div className="rounded-md border border-border bg-surface-muted p-4 text-sm text-content-secondary">
            Reading and validating {fileName}…
          </div>
        )}

        {parseResult && (
          <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-muted p-4 text-sm">
            {parseResult.fileErrors.length > 0 ? (
              <ul className="list-disc pl-5 text-danger">
                {parseResult.fileErrors.map((message, index) => (
                  <li key={index}>{message}</li>
                ))}
              </ul>
            ) : (
              <>
                <p className="text-content-secondary">
                  {parseResult.rows.length} row(s) ready to upload
                  {parseResult.rowErrors.length > 0 && `, ${parseResult.rowErrors.length} row(s) with errors`}.
                </p>
                {parseResult.rowErrors.length > 0 && (
                  <>
                    <ul className="max-h-48 list-disc overflow-y-auto pl-5 text-danger">
                      {parseResult.rowErrors.map((error, index) => (
                        <li key={index}>
                          Row {error.row}: {error.message}
                        </li>
                      ))}
                    </ul>
                    <p className="text-content-muted">
                      Fix these rows in the file and re-select it — the whole batch is rejected together, not row by
                      row.
                    </p>
                  </>
                )}
              </>
            )}
          </div>
        )}

        <p className="text-xs text-content-muted">
          Keep this tab open until processing finishes. Track progress in the upload widget; submitted imports can resume from saved progress after an interruption.
        </p>

        <div className="mt-2 flex gap-2">
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit || isParsing}>
            Upload file
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => (onCancel ? onCancel() : navigate("/input-data"))}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
