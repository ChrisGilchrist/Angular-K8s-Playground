import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, ViewChild, ViewEncapsulation } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Terminal } from 'xterm';
import { AttachAddon } from 'xterm-addon-attach';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class AppComponent {
  title = 'k8s-experiment';
  ws: WebSocket;

  messages = [];
  command: string = '';

  // Command Buffer
  commandBuffer = [];
  commandBufferIndex = 0;

  term: Terminal;
  fitAddon: FitAddon;
  attachAddon: AttachAddon;
  linkAddon: WebLinksAddon;

  @ViewChild('myTerminal') terminalDiv: ElementRef;

  // For testing purposes
  @ViewChild('content') content: ElementRef;
  k8sObjectType: string;
  k8sObjectName: string;

  // https://stackoverflow.com/questions/56828930/how-to-remove-the-last-line-in-xterm-js
  // https://stackoverflow.com/questions/1508490/erase-the-current-printed-console-line


  constructor(private httpClient: HttpClient, private modalService: NgbModal) {
    this.websocketConnector();
  }

  ngOnInit() {

  }

  /**
   * Sets up the web socket connection and terminal ready for use
   */
  ngAfterViewInit() {
    this.term = new Terminal({ convertEol: true });
    this.term.open(this.terminalDiv.nativeElement);
    this.term.writeln('Kubectl Remote Terminal Connected. Currently running v1.2 of kubectl');
    this.term.writeln('');

    this.fitAddon = new FitAddon();
    this.term.loadAddon(this.fitAddon);

    // THIS COULD BE USEFUL FOR WHEN TALKING TO A WEBSOCKET DIRECTLY
    // MEANS YOU DONT HAVE TO HANDLE THE KEY PRESSES
    //this.attachAddon = new AttachAddon(this.ws);
    //this.term.loadAddon(this.attachAddon);

    this.linkAddon = new WebLinksAddon();
    this.term.loadAddon(this.linkAddon);

    this.term.onKey(e => {
      console.log(e.key)
      switch (e.domEvent.key) {

        case 'Backspace':
          this.backspaceCommand();
          return;

        case 'Escape':
          this.escapeCommand();
          return;

        case 'ArrowUp':
          this.arrowUp();
          return;

        case 'ArrowDown':
          this.arrowDown();
          return;
      }

      // If it is a return key then we send the command and right a new line in the editor
      if (e.key == '\r') {
        this.sendCommand();
        this.term.write('\n');
      } else {
        this.command += e.key;
      }

      // Write the key to the editor
      this.term.write(e.key);
    });


    setTimeout(() => {
      this.fitAddon.fit();
    });

  }

  /**
   * Handles the web socket connection to the server
   */
  websocketConnector() {
    const url = 'ws://localhost:8080/test';
    this.ws = new WebSocket(url);

    this.ws.onopen = (event) => {
      console.log('connection opened: ', event);
    }

    this.ws.onmessage = (message) => {
      //console.log(message)
      this.term.write(message.data)
      this.term.write('\n');
    }

    this.ws.onerror = (event) => {
      console.log('Websocket Error: ', event);
    };

  }

  backendConnector() {
    this.httpClient.get("http://localhost:8080/user/1").toPromise().then(res => {
      console.log(res);
    }).catch(err => {
      console.log(err);
    });
  }

  /**
   * Firstly checks the command to ensure it is suitable to be sent.
   * If it passes the checks, then it will send the command to the websocket connection
   */
  sendCommand() {

    if (this.command != '') {

      // Check if they want to clear
      if (this.command.includes('clear')) {
        this.resetTerminal();
        return;
      }


      // Check if the command contains "kubectl edit", if so then oppen modal editor
      if (this.command.includes('edit')) {
        const commandSplit: string[] = this.command.split(' ');
        // Legit command
        if (commandSplit.length > 0 && commandSplit[0] == 'kubectl') {

          // We can assume that 2 is the type of object we are editing
          this.k8sObjectType = commandSplit[2];

          // Then the name of the object it self should follow
          this.k8sObjectName = commandSplit[3];

          // Open the modal for the editor with the info we currently have
          this.openModal(this.content);

        }
      }

      // Send the command to the server side via websockets and reset commands etc...
      this.ws.send(this.command);
      this.commandBuffer.push(this.command);
      this.commandBufferIndex = this.commandBuffer.length + 1;
      this.command = '';
    }
  }

  /**
   * Used to reset the terminal and the buffer
   */
  resetTerminal(): void {
    this.term.reset();
    this.command = '';
    this.commandBuffer.length = 0;
    this.commandBufferIndex = 0;
    this.term.writeln('Kubectl Remote Terminal Connected. Currently running v1.2 of kubectl');
  }


  /**
   * Handles the backspace command, clearing the last character
   * and moving the cursor back one
   */
  backspaceCommand(): void {
    this.term.write('\b \b');
    this.command = this.command.slice(0, -1);
    this.commandBufferIndex = this.commandBuffer.length;
  }

  /**
   * Handles the escape command, clearing the whole line
   * and move the cursor back to the beginning
   */
  escapeCommand(): void {
    this.term.write('\x1b[2K\r');
    this.command = '';
    this.commandBufferIndex = this.commandBuffer.length - 1;
  }


  arrowUp(): void {

    this.term.write('\x1b[2K\r');

    if (this.commandBuffer.length == 0) {
      console.log('Buffer Empty');
      return;
    }
    if (this.commandBufferIndex == 1) {
      // Do Nothing
    } else {
      this.commandBufferIndex -= 1;
    }
 
    const comFoundBack = this.commandBuffer[this.commandBufferIndex - 1];
    this.term.write(comFoundBack);
    this.command = comFoundBack;
  }


  arrowDown(): void {

    if (this.commandBuffer.length == 0) {
      console.log('BUFFER EMPTY')
      return;
    }

    if (this.commandBufferIndex == this.commandBuffer.length) {
      // Do Nothing
    } else {
      this.commandBufferIndex += 1;
    }

    

    // Clears the current line
    this.term.write('\x1b[2K\r');

    
    console.log(this.commandBufferIndex, this.commandBuffer)
    const comFoundForward = this.commandBuffer[this.commandBufferIndex - 1];
    this.term.write(comFoundForward);
    this.command = comFoundForward;
    return;
  }


  openModal(content): void {
    this.modalService.open(content, { ariaLabelledBy: 'modal-basic-title' }).result.then((result) => {

    }, (reason) => {

    });
  }


}
