// Bluetooth Thermal Printer Utility
// Compatible dengan thermal printer seperti Shark, Epson, etc

export interface PrinterDevice {
  name: string;
  id: string;
}

export interface ReceiptData {
  store_name: string;
  sale_id: string;
  date: string;
  time: string;
  items: Array<{
    name: string;
    qty: number;
    price: number;
    subtotal: number;
  }>;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  payment_method: string;
  cashier_name: string;
  customer_name?: string;
}

// ESC/POS Commands untuk thermal printer
const ESC = '\x1B';
const GS = '\x1D';

class BluetoothThermalPrinter {
  private device: any | null = null;
  private characteristic: any | null = null;
  private isConnected = false;

  // Scan untuk Bluetooth devices
  async scanDevices(): Promise<PrinterDevice[]> {
    try {
      const nav = navigator as any;
      if (!nav.bluetooth) {
        throw new Error('Bluetooth tidak didukung oleh browser ini');
      }

      const device = await nav.bluetooth.requestDevice({
        filters: [
          { name: 'SHARK' }, // Thermal printer Shark
          { name: 'MTP' }, // Generic thermal printer
          { services: ['000018f0-0000-1000-8000-00805f9b34fb'] }, // SPP service UUID
        ],
      });

      return [{ name: device.name || 'Unknown Device', id: device.id }];
    } catch (error) {
      console.error('Error scanning devices:', error);
      throw new Error(`Scan gagal: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Connect ke printer
  async connect(deviceId: string): Promise<boolean> {
    try {
      const nav = navigator as any;
      if (!nav.bluetooth) {
        throw new Error('Bluetooth tidak didukung');
      }

      // Request device by ID
      const devices = await nav.bluetooth.getDevices();
      const targetDevice = devices.find((d: any) => d.id === deviceId);

      if (!targetDevice) {
        throw new Error('Device tidak ditemukan');
      }

      // Connect ke GATT
      const gattServer = await targetDevice.gatt?.connect();
      if (!gattServer) throw new Error('Tidak bisa connect ke GATT');

      // Get Serial Port Profile service (SPP)
      const service = await gattServer.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      
      // Get characteristic untuk write
      const characteristic = await service.getCharacteristic('00002ad1-0000-1000-8000-00805f9b34fb');

      this.device = targetDevice;
      this.characteristic = characteristic;
      this.isConnected = true;

      console.log('✔ Printer berhasil terhubung!');
      return true;
    } catch (error) {
      console.error('Error connecting to printer:', error);
      this.isConnected = false;
      throw new Error(`Connection error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  // Disconnect
  async disconnect(): Promise<void> {
    try {
      if (this.device?.gatt?.connected) {
        this.device.gatt.disconnect();
      }
      this.isConnected = false;
      console.log('Printer disconnected');
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  }

  // Check connection status
  isDeviceConnected(): boolean {
    return this.isConnected && this.device?.gatt?.connected === true;
  }

  // Send command ke printer
  private async sendCommand(data: Uint8Array): Promise<void> {
    try {
      if (!this.isDeviceConnected() || !this.characteristic) {
        throw new Error('Printer tidak terhubung');
      }

      await this.characteristic.writeValue(data);
      // Add delay untuk give printer time to process
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Error sending command:', error);
      throw error;
    }
  }

  // Reset printer
  private async reset(): Promise<void> {
    const cmd = new Uint8Array([0x1B, 0x40]); // ESC @ - Reset
    await this.sendCommand(cmd);
  }

  // Set print mode (normal, bold, etc)
  private async setStyle(style: 'normal' | 'bold' | 'large'): Promise<void> {
    const commands: Record<string, Uint8Array> = {
      normal: new Uint8Array([0x1B, 0x21, 0x00]),
      bold: new Uint8Array([0x1B, 0x21, 0x08]),
      large: new Uint8Array([0x1B, 0x21, 0x30]), // Large text
    };
    await this.sendCommand(commands[style]);
  }

  // Set text alignment (left=0, center=1, right=2)
  private async setAlignment(alignment: 0 | 1 | 2): Promise<void> {
    const cmd = new Uint8Array([0x1B, 0x61, alignment]);
    await this.sendCommand(cmd);
  }

  // Print text
  private async printText(text: string): Promise<void> {
    // Convert text to bytes
    const textBytes = new TextEncoder().encode(text);
    await this.sendCommand(textBytes);
  }

  // Print line
  private async printLine(text: string = ''): Promise<void> {
    await this.printText(text + '\n');
  }

  // Print separator line
  private async printSeparator(char: string = '-'): Promise<void> {
    const line = Array(32).fill(char).join('');
    await this.printLine(line);
  }

  // Format currency (IDR)
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  // Print receipt
  async printReceipt(data: ReceiptData): Promise<void> {
    try {
      if (!this.isDeviceConnected()) {
        throw new Error('Printer tidak terhubung');
      }

      await this.reset();

      // Header
      await this.setAlignment(1); // Center
      await this.setStyle('large');
      await this.printLine(data.store_name);
      await this.setStyle('normal');
      await this.printLine('RECEIPT');
      await this.printLine(`ID: ${data.sale_id}`);
      await this.printLine(`${data.date} ${data.time}`);
      await this.printSeparator();

      // Items
      await this.setAlignment(0); // Left
      for (const item of data.items) {
        // Item name
        await this.printLine(item.name);
        // Qty x Price = Subtotal
        const qtyLine = `${item.qty}x ${this.formatCurrency(item.price)} = ${this.formatCurrency(item.subtotal)}`;
        await this.printLine(qtyLine);
      }

      await this.printSeparator();

      // Summary
      await this.setAlignment(1); // Center
      await this.printLine(`Subtotal: ${this.formatCurrency(data.subtotal)}`);
      if (data.discount > 0) {
        await this.printLine(`Discount: -${this.formatCurrency(data.discount)}`);
      }
      if (data.tax > 0) {
        await this.printLine(`Tax: ${this.formatCurrency(data.tax)}`);
      }

      await this.setStyle('bold');
      await this.printLine(`TOTAL: ${this.formatCurrency(data.total)}`);
      await this.setStyle('normal');

      await this.printSeparator();

      // Payment info
      await this.printLine(`Payment: ${data.payment_method}`);
      await this.printLine(`Cashier: ${data.cashier_name}`);
      if (data.customer_name) {
        await this.printLine(`Customer: ${data.customer_name}`);
      }

      // Footer
      await this.printLine('');
      await this.setAlignment(1);
      await this.printLine('Thank you for your purchase!');
      await this.printLine('Terima kasih atas pembelian Anda');

      // Finish
      await this.printLine('\n\n\n');
      console.log('✔ Receipt printed successfully!');
    } catch (error) {
      console.error('Error printing receipt:', error);
      throw new Error(`Print failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  // Test print
  async testPrint(): Promise<void> {
    try {
      await this.reset();
      await this.setAlignment(1);
      await this.setStyle('large');
      await this.printLine('PRINTER TEST');
      await this.setStyle('normal');
      await this.printLine('Connection successful!');
      await this.printLine('');
      await this.printLine('\n');
    } catch (error) {
      console.error('Test print failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const bluetoothPrinter = new BluetoothThermalPrinter();

// Export type
export type { BluetoothThermalPrinter };
