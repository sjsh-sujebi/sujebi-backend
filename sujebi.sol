// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.0;

contract StudentIdentification {
    address public owner;

    modifier onlyOwner {
      require(msg.sender == owner, "Only the owner can run this function");
      _;
    }

    constructor () {
      owner = msg.sender;
    }

    struct Signature {
      bytes32 hash; // This is the raw message hash without any prefix
      uint8 v;
      bytes32 r;
      bytes32 s;
    }

    struct Compliment {
      bytes32 from;
      string message;
    }

    mapping(bytes32 => Signature) public signedStudents;
    mapping(bytes32 => Compliment[]) public compliments;

    function uploadStudent(bytes32 hash, uint8 v, bytes32 r, bytes32 s) public onlyOwner {
      require(signedStudents[hash].v == 0, "The student is already signed");
      signedStudents[hash] = Signature(hash, v, r, s);
    }

    // this hash is a raw hash without any prefix
    function verifyStudent(bytes32 hash) public view returns (bool) {
      Signature memory sign = signedStudents[hash];
      bytes memory prefix = "\x19Ethereum Signed Message:\n32";
      bytes32 prefixedHash = keccak256(abi.encodePacked(prefix, hash));
      address recoveredSigner = ecrecover(prefixedHash, sign.v, sign.r, sign.s);
      return recoveredSigner == owner;
    }

    function addCompliment(bytes32 hash, bytes32 myHash, string memory complimentValue) public {
      compliments[hash].push(Compliment({from: myHash, message: complimentValue}));
    }

    function getCompliments(bytes32 hash) public view returns (Compliment[] memory) {
      return compliments[hash];
    }
}