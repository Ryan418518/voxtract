export interface WorksheetData {
  text: string;
  title: string;
  fileSize?: number;
  provider?: string;
  model?: string;
}

let _data: WorksheetData | null = null;

export const worksheetStore = {
  set(data: WorksheetData) {
    _data = { ...data };
  },
  get(): WorksheetData | null {
    return _data ? { ..._data } : null;
  },
  clear() {
    _data = null;
  },
};
