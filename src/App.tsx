import { Button, IconButton, Card, ListRow, Input, Sheet, Menu, Dialog } from './ui';
import { Icon } from './ui/icons';
import { useState } from 'react';

function App() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="p-6 max-w-md mx-auto min-h-screen pb-24">
      <h1 className="text-xl font-bold mb-6 text-text">Talika To-Do - Stage 0</h1>
      
      <Card className="mb-4">
        <h2 className="text-text-muted mb-2 text-sm">Primitives Test</h2>
        <div className="flex gap-2 mb-4">
          <Button onClick={() => setSheetOpen(true)}>Open Sheet</Button>
          <Button onClick={() => setDialogOpen(true)}>Open Dialog</Button>
          <div className="relative">
            <IconButton onClick={() => setMenuOpen(true)}>
              <Icon name="more" />
            </IconButton>
            <Menu isOpen={menuOpen} onClose={() => setMenuOpen(false)}>
              <div className="p-2 hover:bg-surface cursor-pointer rounded">Item 1</div>
              <div className="p-2 hover:bg-surface cursor-pointer rounded">Item 2</div>
            </Menu>
          </div>
        </div>
        
        <Input placeholder="Type here..." className="mb-4" />
        
        <ListRow>
          <Icon name="check" className="text-accent" />
          <span className="text-text">Example Task 1</span>
        </ListRow>
        <ListRow>
          <Icon name="circle" className="text-text-muted" />
          <span className="text-text">Example Task 2</span>
        </ListRow>
      </Card>

      <Sheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)}>
        <h3 className="font-bold mb-2">Bottom Sheet</h3>
        <p className="text-text-muted mb-4">This is composed from primitives.</p>
        <Button onClick={() => setSheetOpen(false)}>Close</Button>
      </Sheet>

      <Dialog isOpen={dialogOpen} onClose={() => setDialogOpen(false)}>
        <h3 className="font-bold mb-2">Modal Dialog</h3>
        <p className="text-text-muted mb-4">Also a basic primitive.</p>
        <Button onClick={() => setDialogOpen(false)} className="w-full">Done</Button>
      </Dialog>
    </div>
  )
}

export default App;
