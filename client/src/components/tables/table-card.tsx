import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useState } from "react";
import { QrCode, Pencil, Trash } from "lucide-react";

interface Table {
  id: number;
  number: number;
  qrCode: string;
  restaurantId: number;
  isOccupied: boolean;
}

interface TableCardProps {
  table: Table;
  onEdit: () => void;
  onDelete: () => void;
  onToggleOccupied: () => void;
}

export function TableCard({ table, onEdit, onDelete, onToggleOccupied }: TableCardProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);

  const handleDelete = () => {
    onDelete();
    setIsDeleteDialogOpen(false);
  };

  return (
    <>
      <Card className={`${table.isOccupied ? 'border-brand' : ''}`}>
        <CardContent className="p-4 text-center">
          <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-2 ${table.isOccupied ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
            <span className="text-lg font-bold">{table.number}</span>
          </div>
          <h3 className="font-medium">Table {table.number}</h3>
          <Badge className="mt-2" variant={table.isOccupied ? "default" : "outline"}>
            {table.isOccupied ? "Occupied" : "Free"}
          </Badge>
        </CardContent>
        <CardFooter className="grid grid-cols-3 gap-1 p-2 border-t">
          <Button variant="ghost" size="sm" onClick={() => setIsQrDialogOpen(true)}>
            <QrCode className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIsDeleteDialogOpen(true)}>
            <Trash className="h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Table</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete Table {table.number}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* QR Code Dialog */}
      <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Table {table.number} QR Code</DialogTitle>
            <DialogDescription>
              Customers can scan this QR code to access the menu and place orders.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center my-4">
            <img src={table.qrCode} alt={`QR Code for Table ${table.number}`} className="max-w-full h-auto" />
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsQrDialogOpen(false)}
            >
              Close
            </Button>
            <Button 
              variant="default"
              onClick={() => {
                // Create a download link for the QR code
                const a = document.createElement('a');
                a.href = table.qrCode;
                a.download = `table-${table.number}-qr-code.png`;
                a.click();
              }}
            >
              Download
            </Button>
            <Button
              variant={table.isOccupied ? "destructive" : "default"}
              onClick={() => {
                onToggleOccupied();
                setIsQrDialogOpen(false);
              }}
            >
              Mark as {table.isOccupied ? "Free" : "Occupied"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
