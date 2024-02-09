#![no_std]

multiversx_sc::imports!();

use multiversx_sc::hex_literal::hex;

#[multiversx_sc::contract]
pub trait StakingBank:
    staking_bank_static_module::StakingBankStaticModule + staking_bank_static_module::events::StakingBankStaticEventsModule
{
    #[init]
    fn init(&self) {
        self.remove_all();

        // erd198sw08p6qwj0kfvtvzsxh0en0k7k8fszazpj7lwphmym7hwqpkps0wjqzs
        self.create(
            ManagedAddress::from(hex!("29e0e79c3a03a4fb258b60a06bbf337dbd63a602e8832f7dc1bec9bf5dc00d83")),
            ManagedBuffer::from(b"https://validator.umb.network")
        );

        // erd1gzeggan5v58lat67tz5qnf9qgnrpczuzh94rjfxg8m3f0ujezvxqtekfvd
        self.create(
            ManagedAddress::from(hex!("40b2847674650ffeaf5e58a809a4a044c61c0b82b96a3924c83ee297f259130c")),
            ManagedBuffer::from(b"https://validator2.umb.network")
        );

        // erd1c2v0rsg4xrm7cx7530mn5vhk2pjyqe3l0fwsx8fkczjnlpng3d2qx4hs20
        self.create(
            ManagedAddress::from(hex!("c298f1c11530f7ec1bd48bf73a32f6506440663f7a5d031d36c0a53f86688b54")),
            ManagedBuffer::from(b"https://umb.stakers.world")
        );

        // erd13n6vxcq7lvhe89vrrcda0x7z5zdsd4uqs0xnxzzne6c3rw5pwr9sdqe9re
        self.create(
            ManagedAddress::from(hex!("8cf4c3601efb2f9395831e1bd79bc2a09b06d78083cd330853ceb111ba8170cb")),
            ManagedBuffer::from(b"https://umbrella.artemahr.tech")
        );

        // erd19gyl29fp0hxeh2wqpjwkympsxg3t7sjx6vxye72jyp6vwphtv63sfaggqh
        self.create(
            ManagedAddress::from(hex!("2a09f515217dcd9ba9c00c9d626c303222bf4246d30c4cf9522074c706eb66a3")),
            ManagedBuffer::from(b"https://umb.anorak.technology")
        );

        // erd15d0djse8elt84mjfu6a9sd6x9dyq9x5sttz5ml2vflykfeu5x8tsmpa98y
        self.create(
            ManagedAddress::from(hex!("a35ed94327cfd67aee49e6ba5837462b48029a905ac54dfd4c4fc964e79431d7")),
            ManagedBuffer::from(b"http://5.161.78.230:3000")
        );

        // erd156sysd9cwd6xuvkhy06m8gl29xkmnjxd8agtdcnlezf6dv3u27uqeyxasr
        self.create(
            ManagedAddress::from(hex!("a6a04834b873746e32d723f5b3a3ea29adb9c8cd3f50b6e27fc893a6b23c57b8")),
            ManagedBuffer::from(b"https://umb.hashquark.io")
        );

        // erd1gtjluk0huuc3aes9r6u9wud9rhlukk39vnhhwugc8euy2n7q92nsqa6ylw
        self.create(
            ManagedAddress::from(hex!("42e5fe59f7e7311ee6051eb85771a51dffcb5a2564ef7771183e78454fc02aa7")),
            ManagedBuffer::from(b"http://umbrella.staking4all.org:3000")
        );

        // erd1jc8yj7hzgm20q3hxcj22gfenyuqy59sz99l0k59mfj67vqq5zraqxar399
        self.create(
            ManagedAddress::from(hex!("960e497ae246d4f046e6c494a4273327004a1602297efb50bb4cb5e6001410fa")),
            ManagedBuffer::from(b"https://umb-api.staking.rocks")
        );

        // erd192dt74tp0fmwgk5trckg7fv65e52zfp2mm4aq2xsyps3krz9ddksykl4yd
        self.create(
            ManagedAddress::from(hex!("2a9abf55617a76e45a8b1e2c8f259aa668a1242adeebd028d020611b0c456b6d")),
            ManagedBuffer::from(b"https://umb.vtabsolutions.com:3030")
        );

        // erd15l77l93dzkve8k8zsp4wl6qkwfv69sce2qkz8wqgsg2kz9smeufsx7a48a
        self.create(
            ManagedAddress::from(hex!("a7fdef962d159993d8e2806aefe8167259a2c319502c23b808821561161bcf13")),
            ManagedBuffer::from(b"https://umbrella.crazywhale.es")
        );

        // erd1k7w3ukh9pnhlraf5dqq24s0xlprwklfsx86dtl8mlr4lvzvhhj3qwkfk57
        self.create(
            ManagedAddress::from(hex!("b79d1e5ae50ceff1f5346800aac1e6f846eb7d3031f4d5fcfbf8ebf60997bca2")),
            ManagedBuffer::from(b"https://umbrella-node.gateomega.com")
        );

        // erd1kz7ws89rr7mzrcz2xr50hu0602fj5kv77xfrrda6wgfmj938ksksqsagkh
        self.create(
            ManagedAddress::from(hex!("b0bce81ca31fb621e04a30e8fbf1fa7a932a599ef19231b7ba7213b91627b42d")),
            ManagedBuffer::from(b"https://rpc.urbanhq.net")
        );

        // erd16vna0vl3xyyx0ecasmhxspac357jvjkvpgj5hj7hd2wt9xdxy5xqxgg5zq
        self.create(
            ManagedAddress::from(hex!("d327d7b3f1310867e71d86ee6807b88d3d264acc0a254bcbd76a9cb299a6250c")),
            ManagedBuffer::from(b"https://umbrella-node.ankastake.com")
        );

        // erd1zuaxlfxfx2qmr23v97nv5kq6m6w0tq6f9jgp4z2fj65s9dwl3rjsalnas0
        self.create(
            ManagedAddress::from(hex!("173a6fa4c93281b1aa2c2fa6ca581ade9cf583492c901a894996a902b5df88e5")),
            ManagedBuffer::from(b"https://umbrella.tchambrella.com")
        );

        // erd19ukr066kvnhrqylgxhc2hgndqmex06wpxkrd9hrk0z92em2avnsq2rcgm0
        self.create(
            ManagedAddress::from(hex!("2f2c37eb5664ee3013e835f0aba26d06f267e9c13586d2dc76788aaced5d64e0")),
            ManagedBuffer::from(b"https://umbrella-node.cmt13.eu")
        );

        // erd15ltypaen3k0wevpv33kydqkydad5r2fv2lxnzmapgcrqremy6gasf40y3x
        self.create(
            ManagedAddress::from(hex!("a7d640f7338d9eecb02c8c6c4682c46f5b41a92c57cd316fa1460601e764d23b")),
            ManagedBuffer::from(b"https://umbnode.blockchainliverpool.com")
        );

        // erd12w5avlep5s8w66l7w8tu7vgeqjdu7pc3rps42suprntwag7n50pss35n94
        self.create(
            ManagedAddress::from(hex!("53a9d67f21a40eed6bfe71d7cf3119049bcf071118615543811cd6eea3d3a3c3")),
            ManagedBuffer::from(b"https://umbrella.validator.infstones.io")
        );

        // erd1qsn4nelywclhtucw8p056v97dtd3nrnvq36crwqfkkyaaemqvehqx4stq3
        self.create(
            ManagedAddress::from(hex!("042759e7e4763f75f30e385f4d30be6adb198e6c047581b809b589dee760666e")),
            ManagedBuffer::from(b"https://umbrella-api.validatrium.club")
        );
    }

    #[upgrade]
    fn upgrade(&self) {
        self.init();
    }
}
