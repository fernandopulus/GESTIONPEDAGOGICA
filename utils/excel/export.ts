import * as XLSX from 'xlsx';

interface ExportToExcelOptions<T> {
  data: T[];
  fileName: string;
  sheetName?: string;
}

/**
 * Exports an array of objects to an Excel file.
 * @param data The array of data to export.
 * @param fileName The name of the file to be created (without extension).
 * @param sheetName The name of the sheet within the Excel file.
 */
export function exportToExcel<T extends Record<string, any>>({
  data,
  fileName,
  sheetName = 'Sheet 1',
}: ExportToExcelOptions<T>): void {
  try {
    // Create a new workbook
    const wb = XLSX.utils.book_new();

    // Convert the array of objects to a worksheet
    const ws = XLSX.utils.json_to_sheet(data);

    // Append the worksheet to the workbook
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Generate the Excel file and trigger the download
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  } catch (error) {
    console.error("Error exporting to Excel:", error);
    // Optionally, show an error message to the user
    alert("Hubo un error al generar el archivo de Excel. Por favor, intente de nuevo.");
  }
}
