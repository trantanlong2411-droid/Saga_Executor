// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * TESTNET SANDBOX ONLY. This contract is not an AMM/DEX, has no price discovery,
 * and must not be treated as a real-money swap or a production vault.
 */
contract SagaToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory n, string memory s, uint256 amount, address recipient) {
        name=n; symbol=s;
        totalSupply=amount;
        balanceOf[recipient]=amount;
        emit Transfer(address(0),recipient,amount);
    }

    function approve(address spender,uint256 amount) external returns (bool) {
        allowance[msg.sender][spender]=amount;
        emit Approval(msg.sender,spender,amount);
        return true;
    }

    function transfer(address to,uint256 amount) external returns (bool) {
        _transfer(msg.sender,to,amount); return true;
    }

    function transferFrom(address from,address to,uint256 amount) external returns (bool) {
        uint256 approved=allowance[from][msg.sender];
        require(approved>=amount,"ALLOWANCE");
        if(approved!=type(uint256).max) {
            allowance[from][msg.sender]=approved-amount;
            emit Approval(from,msg.sender,approved-amount);
        }
        _transfer(from,to,amount);return true;
    }

    function _transfer(address from,address to,uint256 amount) internal {
        require(to!=address(0),"ZERO_RECEIVER");
        require(balanceOf[from]>=amount,"INSUFFICIENT_BALANCE");
        balanceOf[from]-=amount;
        balanceOf[to]+=amount;
        emit Transfer(from,to,amount);
    }
}

contract SagaPlayground {
    SagaToken public immutable tokenA;
    SagaToken public immutable tokenB;

    mapping(address=>uint256) public pending;
    mapping(address=>uint256) public deposited;
    uint256 public outstandingB;

    event Swapped(address indexed account,uint256 amount);
    event Deposited(address indexed account,uint256 amount);
    event SwapCompensated(address indexed account,uint256 amount);
    event DepositUndone(address indexed account,uint256 amount);

    constructor(){
        tokenA=new SagaToken("Saga Test Asset A","SGA",10000 ether,msg.sender);
        tokenB=new SagaToken("Saga Test Asset B","SGB",10000 ether,address(this));
    }

    // STEP 1 = tokenA.approve(address(this),amount) on the ERC20 token contract.
    // STEP 2 = on-chain escrow-backed fixed 1:1 TESTNET conversion.
    function swap(uint256 amount) external {
        require(amount>0,"ZERO_AMOUNT");
        require(outstandingB+amount<=tokenB.balanceOf(address(this)),"NO_B_RESERVE");
        require(tokenA.transferFrom(msg.sender,address(this),amount),"TOKEN_TRANSFER_FAILED");
        outstandingB+=amount;
        pending[msg.sender]+=amount;
        emit Swapped(msg.sender,amount);
    }

    // STEP 3 = lock pending test B credit in an on-chain vault balance.
    function deposit(uint256 amount) external {
        require(amount>0,"ZERO_AMOUNT");
        require(pending[msg.sender]>=amount,"INSUFFICIENT_PENDING");
        pending[msg.sender]-=amount;
        deposited[msg.sender]+=amount;
        emit Deposited(msg.sender,amount);
    }

    // COMPENSATION for a failed deposit: cancel un-deposited B credit
    // and restore exactly the same amount of A to the caller.
    function compensateSwap(uint256 amount) external {
        require(amount>0 && pending[msg.sender]>=amount,"INSUFFICIENT_PENDING");
        pending[msg.sender]-=amount;
        outstandingB-=amount;
        require(tokenA.transfer(msg.sender,amount),"REFUND_FAILED");
        emit SwapCompensated(msg.sender,amount);
    }

    // Optional reverse path after a fully successful run.
    function undoDeposit(uint256 amount) external {
        require(amount>0 && deposited[msg.sender]>=amount,"INSUFFICIENT_SHARES");
        deposited[msg.sender]-=amount;
        pending[msg.sender]+=amount;
        emit DepositUndone(msg.sender,amount);
    }
}
